import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PassengerType, Prisma } from '@prisma/client';
import { SavedPassengersService } from './saved-passengers.service';
import { SavedPassengerMapper } from '../mappers/saved-passenger.mapper';
import { type CreateSavedPassengerDto } from '../dtos/create-saved-passenger.dto';
import { MAX_SAVED_PASSENGERS } from '../constants/saved-passengers.constants';

function buildTraveler(overrides: Partial<CreateSavedPassengerDto> = {}): CreateSavedPassengerDto {
  return {
    passengerType: PassengerType.ADULT,
    firstName: 'Ivan',
    lastName: 'Ivanov',
    gender: 'MALE',
    dateOfBirth: '1990-01-01',
    passportNumber: '1234567890',
    passportIssuanceDate: '2015-01-01',
    passportExpiry: '2030-01-01',
    ...overrides,
  } as CreateSavedPassengerDto;
}

function buildProfileRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-1',
    userId: 'user-1',
    label: null,
    isPrimary: false,
    passengerType: PassengerType.ADULT,
    firstName: 'IVAN',
    lastName: 'IVANOV',
    gender: 'MALE',
    birthDate: new Date('1990-01-01'),
    nationality: 'RU',
    birthPlace: null,
    passportNumber: '1234567890',
    passportIssuanceDate: new Date('2015-01-01'),
    passportExpiry: new Date('2030-01-01'),
    email: null,
    phoneCountryCode: null,
    phoneNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SavedPassengersService', () => {
  const prisma = {
    savedPassengerProfile: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  };

  const mapper = new SavedPassengerMapper();
  const service = new SavedPassengersService(prisma as never, mapper);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
  });

  describe('createForUser', () => {
    it('runs the duplicate check and insert inside a serializable transaction', async () => {
      prisma.savedPassengerProfile.findUnique.mockResolvedValue(null);
      prisma.savedPassengerProfile.count.mockResolvedValue(0);
      prisma.savedPassengerProfile.create.mockResolvedValue(buildProfileRecord());

      await service.createForUser('user-1', buildTraveler());

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: expect.any(String) }),
      );
    });

    it('translates a unique-constraint race on create into a 409 Conflict', async () => {
      prisma.savedPassengerProfile.findUnique.mockResolvedValue(null);
      prisma.savedPassengerProfile.count.mockResolvedValue(0);
      prisma.savedPassengerProfile.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.createForUser('user-1', buildTraveler())).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects create when saved passenger limit is reached', async () => {
      prisma.savedPassengerProfile.findUnique.mockResolvedValue(null);
      prisma.savedPassengerProfile.count.mockResolvedValue(MAX_SAVED_PASSENGERS);

      await expect(service.createForUser('user-1', buildTraveler())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects create when passport is already saved', async () => {
      prisma.savedPassengerProfile.findUnique.mockResolvedValue(buildProfileRecord());

      await expect(service.createForUser('user-1', buildTraveler())).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('listForUser', () => {
    it('returns mapped passenger profiles ordered for display', async () => {
      const profile = buildProfileRecord();
      prisma.savedPassengerProfile.findMany.mockResolvedValue([profile]);

      const result = await service.listForUser('user-1');

      expect(prisma.savedPassengerProfile.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
      });
      expect(result).toEqual([
        expect.objectContaining({
          id: profile.id,
          passportNumber: profile.passportNumber,
        }),
      ]);
    });
  });

  describe('deleteForUser', () => {
    it('deletes an owned saved passenger profile', async () => {
      prisma.savedPassengerProfile.findFirst.mockResolvedValue(buildProfileRecord());
      prisma.savedPassengerProfile.delete.mockResolvedValue(buildProfileRecord());

      await service.deleteForUser('user-1', 'profile-1');

      expect(prisma.savedPassengerProfile.delete).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
      });
    });

    it('throws NotFoundException when profile does not belong to user', async () => {
      prisma.savedPassengerProfile.findFirst.mockResolvedValue(null);

      await expect(service.deleteForUser('user-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('upsertFromBookingTravelers', () => {
    it('preserves the existing primary flag when the sync payload omits isPrimary', async () => {
      const existingProfile = buildProfileRecord({ id: 'profile-1', isPrimary: true });

      prisma.savedPassengerProfile.findMany
        .mockResolvedValueOnce([existingProfile]) // pre-clear snapshot lookup
        .mockResolvedValueOnce([existingProfile]); // final listForUser
      prisma.savedPassengerProfile.count.mockResolvedValue(0);

      await service.upsertFromBookingTravelers('user-1', [buildTraveler({ isPrimary: undefined })]);

      // Nothing in the batch explicitly requested primary, so the flag must
      // not be cleared, and the update must keep isPrimary: true.
      expect(prisma.savedPassengerProfile.updateMany).not.toHaveBeenCalled();
      expect(prisma.savedPassengerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'profile-1' },
          data: expect.objectContaining({ isPrimary: true }),
        }),
      );
    });

    it('still applies an explicit isPrimary: false from the sync payload', async () => {
      const existingProfile = buildProfileRecord({ id: 'profile-1', isPrimary: true });

      prisma.savedPassengerProfile.findMany
        .mockResolvedValueOnce([existingProfile])
        .mockResolvedValueOnce([existingProfile]);
      prisma.savedPassengerProfile.count.mockResolvedValue(0);

      await service.upsertFromBookingTravelers('user-1', [buildTraveler({ isPrimary: false })]);

      expect(prisma.savedPassengerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isPrimary: false }),
        }),
      );
    });

    it('translates a unique-constraint race on insert into a 409 Conflict', async () => {
      prisma.savedPassengerProfile.findMany.mockResolvedValueOnce([]);
      prisma.savedPassengerProfile.count.mockResolvedValue(0);
      prisma.savedPassengerProfile.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.upsertFromBookingTravelers('user-1', [buildTraveler()]),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects duplicate passport numbers in one sync batch', async () => {
      await expect(
        service.upsertFromBookingTravelers('user-1', [
          buildTraveler({ passportNumber: '1111111111' }),
          buildTraveler({ passportNumber: '1111111111', firstName: 'Petr' }),
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects passport reuse for a different passenger name', async () => {
      const existingProfile = buildProfileRecord({
        firstName: 'PETR',
        lastName: 'PETROV',
      });

      prisma.savedPassengerProfile.findMany
        .mockResolvedValueOnce([existingProfile])
        .mockResolvedValueOnce([existingProfile]);
      prisma.savedPassengerProfile.count.mockResolvedValue(0);

      await expect(
        service.upsertFromBookingTravelers('user-1', [buildTraveler({ firstName: 'Ivan' })]),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
