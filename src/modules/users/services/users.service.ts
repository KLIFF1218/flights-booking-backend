import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { UpdateSettingsDto } from '../dtos/update-settings.dto';
import { UpdateProfileDto } from '../dtos/update-profile.dto';
import { EmailVerificationService } from '../../auth/services/email-verification.service';

const userPublicSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  status: true,
  country: true,
  citizenship: true,
  city: true,
  currency: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const userSettingsSelect = {
  country: true,
  citizenship: true,
  currency: true,
  city: true,
} as const;

/** Minimal user fields for auth flows — never includes password or tokens. */
const userAuthSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  status: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(forwardRef(() => EmailVerificationService))
    private readonly emailVerification: EmailVerificationService,
  ) {}

  async getById(id: string) {
    return await this.prismaService.user.findUnique({
      where: { id },
      select: userAuthSelect,
    });
  }

  async getPublicProfile(id: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id },
      select: userPublicSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getSettings(userId: string) {
    const settings = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: userSettingsSelect,
    });

    if (!settings) {
      throw new NotFoundException('User not found');
    }

    return settings;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    try {
      const { user, emailChanged } = await this.prismaService.$transaction(async (tx) => {
        let emailChanged = false;

        if (dto.email !== undefined) {
          const current = await tx.user.findUnique({
            where: { id: userId },
            select: { email: true },
          });

          emailChanged = current?.email !== dto.email;
        }

        const user = await tx.user.update({
          where: { id: userId },
          data: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
            email: dto.email,
            ...(emailChanged ? { emailVerifiedAt: null } : {}),
          },
          select: userPublicSelect,
        });

        return { user, emailChanged };
      });

      if (emailChanged && user.email) {
        await this.emailVerification.sendForUserSafe(user.id);
      }

      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Email already in use');
        }

        if (error.code === 'P2025') {
          throw new NotFoundException('User not found');
        }
      }

      throw error;
    }
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    try {
      return await this.prismaService.user.update({
        where: {
          id: userId,
        },
        data: {
          country: dto.country,
          citizenship: dto.citizenship,
          city: dto.city,
          currency: dto.currency,
        },
        select: userSettingsSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }

      throw error;
    }
  }
}
