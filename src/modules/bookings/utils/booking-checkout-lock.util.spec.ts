import { type PrismaService } from 'src/infra/db/prisma/prisma.service';
import { withBookingCheckoutLock } from './booking-checkout-lock.util';

describe('withBookingCheckoutLock', () => {
  it('acquires and releases advisory lock around callback', async () => {
    const prisma = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
    };
    const fn = jest.fn().mockResolvedValue('ok');

    await expect(
      withBookingCheckoutLock(prisma as unknown as PrismaService, 'booking-1', fn),
    ).resolves.toBe('ok');

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('releases lock when callback throws', async () => {
    const prisma = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
    };
    const fn = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(
      withBookingCheckoutLock(prisma as unknown as PrismaService, 'booking-1', fn),
    ).rejects.toThrow('boom');

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });
});
