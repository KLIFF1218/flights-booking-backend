import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { runSerializableTransaction } from 'src/common/utils/run-serializable-transaction.util';
import { CreateSavedPassengerDto } from '../dtos/create-saved-passenger.dto';
import { SavedPassengerResponseDto } from '../dtos/saved-passenger-response.dto';
import { NormalizedSavedPassenger, SavedPassengerMapper } from '../mappers/saved-passenger.mapper';
import { MAX_SAVED_PASSENGERS } from '../constants/saved-passengers.constants';

type Tx = Prisma.TransactionClient;
type SavedPassengerProfile = Prisma.SavedPassengerProfileGetPayload<object>;

/**
 * Orchestrates persistence for saved passenger profiles. Domain rules
 * (validation, normalization, response mapping) live in SavedPassengerMapper;
 * this service is only responsible for querying/writing the database and
 * keeping multi-step writes atomic.
 */
@Injectable()
export class SavedPassengersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: SavedPassengerMapper,
  ) {}

  async listForUser(userId: string): Promise<SavedPassengerResponseDto[]> {
    const profiles = await this.prisma.savedPassengerProfile.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
    });

    return profiles.map((profile) => this.mapper.toResponse(profile));
  }

  async createForUser(
    userId: string,
    dto: CreateSavedPassengerDto,
  ): Promise<SavedPassengerResponseDto> {
    if (!this.mapper.canPersist(dto)) {
      throw new BadRequestException('Passenger profile is incomplete');
    }

    const normalized = this.mapper.normalize(dto);

    // Serializable isolation protects the "no existing passport, then maybe
    // clear the current primary, then insert" sequence from concurrent
    // requests for the same user (e.g. two tabs both creating a primary
    // passenger). Postgres aborts one side with a P2034 conflict instead of
    // letting both succeed and leave two primary passengers.
    const profile = await runSerializableTransaction(this.prisma, async (tx) => {
      const existing = await tx.savedPassengerProfile.findUnique({
        where: {
          userId_passportNumber: {
            userId,
            passportNumber: normalized.passportNumber,
          },
        },
      });

      if (existing) {
        throw new ConflictException('Passenger with this passport already saved');
      }

      await this.assertUnderSavedPassengerLimit(tx, userId);

      if (dto.isPrimary) {
        await this.clearPrimaryFlag(tx, userId);
      }

      try {
        return await tx.savedPassengerProfile.create({
          data: this.mapper.toCreateData(userId, normalized),
        });
      } catch (error) {
        this.rethrowAsConflictIfDuplicate(error, normalized.passportNumber);
      }
    });

    return this.mapper.toResponse(profile);
  }

  async deleteForUser(userId: string, profileId: string): Promise<void> {
    const profile = await this.prisma.savedPassengerProfile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundException('Saved passenger not found');
    }

    await this.prisma.savedPassengerProfile.delete({
      where: { id: profileId },
    });
  }

  async upsertFromBookingTravelers(
    userId: string,
    travelers: CreateSavedPassengerDto[],
  ): Promise<SavedPassengerResponseDto[]> {
    const persistableTravelers = travelers.filter((traveler) => this.mapper.canPersist(traveler));

    this.assertUniquePassportNumbers(persistableTravelers);

    await runSerializableTransaction(this.prisma, async (tx) => {
      // Snapshot each traveler's current primary flag *before* the batch
      // clear below. Travelers in this sync payload that omit `isPrimary`
      // must keep whatever primary state they already had; reading it after
      // the clear would always see `false` and silently unset the user's
      // primary passenger.
      const existingByPassport = await this.loadExistingByPassport(
        tx,
        userId,
        persistableTravelers,
      );

      const newPassportCount = persistableTravelers.filter(
        (traveler) => !existingByPassport.has(traveler.passportNumber!.trim()),
      ).length;

      if (newPassportCount > 0) {
        await this.assertUnderSavedPassengerLimit(tx, userId, newPassportCount);
      }

      if (persistableTravelers.some((traveler) => traveler.isPrimary)) {
        await this.clearPrimaryFlag(tx, userId);
      }

      for (const traveler of persistableTravelers) {
        const normalized = this.mapper.normalize(traveler);
        await this.upsertSingleTraveler(
          tx,
          userId,
          normalized,
          existingByPassport.get(normalized.passportNumber),
        );
      }
    });

    return this.listForUser(userId);
  }

  private async loadExistingByPassport(
    tx: Tx,
    userId: string,
    travelers: CreateSavedPassengerDto[],
  ): Promise<Map<string, SavedPassengerProfile>> {
    const passportNumbers = travelers
      .map((traveler) => traveler.passportNumber?.trim())
      .filter((passportNumber): passportNumber is string => Boolean(passportNumber));

    if (passportNumbers.length === 0) {
      return new Map();
    }

    const profiles = await tx.savedPassengerProfile.findMany({
      where: { userId, passportNumber: { in: passportNumbers } },
    });

    return new Map(profiles.map((profile) => [profile.passportNumber, profile]));
  }

  private async upsertSingleTraveler(
    tx: Tx,
    userId: string,
    normalized: NormalizedSavedPassenger,
    existing: SavedPassengerProfile | undefined,
  ): Promise<void> {
    if (existing) {
      if (this.mapper.isDifferentPassenger(existing, normalized)) {
        throw new ConflictException(
          `Passport ${normalized.passportNumber} is already saved for another passenger`,
        );
      }

      const {
        userId: _userId,
        isPrimary: _isPrimary,
        ...data
      } = this.mapper.toCreateData(userId, normalized);

      await tx.savedPassengerProfile.update({
        where: { id: existing.id },
        data: {
          ...data,
          isPrimary: normalized.isPrimary ?? existing.isPrimary,
        },
      });
      return;
    }

    if (normalized.isPrimary) {
      await this.clearPrimaryFlag(tx, userId);
    }

    try {
      await tx.savedPassengerProfile.create({
        data: this.mapper.toCreateData(userId, normalized),
      });
    } catch (error) {
      this.rethrowAsConflictIfDuplicate(error, normalized.passportNumber);
    }
  }

  private assertUniquePassportNumbers(travelers: CreateSavedPassengerDto[]) {
    try {
      this.mapper.assertUniquePassportNumbers(travelers);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  private async clearPrimaryFlag(tx: Tx, userId: string) {
    await tx.savedPassengerProfile.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  private async assertUnderSavedPassengerLimit(
    tx: Tx,
    userId: string,
    additional = 1,
  ): Promise<void> {
    const count = await tx.savedPassengerProfile.count({ where: { userId } });

    if (count + additional > MAX_SAVED_PASSENGERS) {
      throw new BadRequestException(`Maximum ${MAX_SAVED_PASSENGERS} saved passengers allowed`);
    }
  }

  /**
   * The pre-check via `findUnique` above narrows the common case, but the
   * `@@unique([userId, passportNumber])` constraint is the real guarantee
   * under concurrency: two simultaneous requests for the same new passport
   * can both pass the pre-check and race to `create`. Whichever loses hits
   * Prisma error P2002, which we translate into a normal 409 instead of
   * letting it surface as an unhandled 500.
   */
  private rethrowAsConflictIfDuplicate(error: unknown, passportNumber: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(`Passenger with passport ${passportNumber} already saved`);
    }

    throw error;
  }
}
