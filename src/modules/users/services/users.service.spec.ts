import { Test, type TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { EmailVerificationService } from '../../auth/services/email-verification.service';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: typeof mockPrismaService) => unknown) => fn(mockPrismaService)),
};

const mockEmailVerification = {
  sendForUserSafe: jest.fn().mockResolvedValue(undefined),
};

const responseUser = {
  id: '123456',
  email: 'sfasff@gma.com',
  firstName: 'Max',
  lastName: 'Test',
};

const settings = {
  country: 'RU',
  citizenship: 'RU',
  currency: 'RUB',
  city: 'Moscow',
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EmailVerificationService,
          useValue: mockEmailVerification,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPublicProfile', () => {
    it('should find a user by ID without sensitive fields', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(responseUser);
      const result = await service.getPublicProfile('123456');

      expect(result).toEqual(responseUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: responseUser.id },
        select: expect.not.objectContaining({ password: true }),
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getPublicProfile('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getSettings', () => {
    it('returns only settings fields', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(settings);

      const result = await service.getSettings('123456');

      expect(result).toEqual(settings);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            country: true,
            citizenship: true,
            currency: true,
            city: true,
          }),
        }),
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getSettings('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getById', () => {
    it('does not select password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: '123456', status: 'ACTIVE' });

      await service.getById('123456');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: '123456' },
        select: expect.not.objectContaining({ password: true }),
      });
    });
  });

  describe('updateProfile', () => {
    it('should update profile without returning password', async () => {
      mockPrismaService.user.update.mockResolvedValue(responseUser);

      const result = await service.updateProfile('123456', { firstName: 'Jane' });

      expect(result).toEqual(responseUser);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '123456' },
          select: expect.not.objectContaining({ password: true }),
        }),
      );
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should reset emailVerifiedAt when email changes', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ email: 'old@example.com' });
      mockPrismaService.user.update.mockResolvedValue({
        ...responseUser,
        email: 'new@example.com',
        emailVerifiedAt: null,
      });

      await service.updateProfile('123456', { email: 'new@example.com' });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'new@example.com', emailVerifiedAt: null }),
        }),
      );
      expect(mockEmailVerification.sendForUserSafe).toHaveBeenCalledWith('123456');
    });

    it('should not touch emailVerifiedAt if email did not change', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ email: 'same@example.com' });
      mockPrismaService.user.update.mockResolvedValue(responseUser);

      await service.updateProfile('123456', { email: 'same@example.com' });

      const call = mockPrismaService.user.update.mock.calls[0][0];
      expect(call.data).not.toHaveProperty('emailVerifiedAt');
    });

    it('should throw ConflictException if email is already taken', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ email: 'old@example.com' });
      mockPrismaService.user.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.updateProfile('123456', { email: 'taken@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ email: 'old@example.com' });
      mockPrismaService.user.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.updateProfile('missing', { email: 'new@example.com' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateSettings', () => {
    it('returns only settings fields', async () => {
      mockPrismaService.user.update.mockResolvedValue(settings);

      const result = await service.updateSettings('123456', { city: 'Moscow' });

      expect(result).toEqual(settings);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            country: true,
            citizenship: true,
            currency: true,
            city: true,
          }),
        }),
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrismaService.user.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );

      await expect(service.updateSettings('missing', { city: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
