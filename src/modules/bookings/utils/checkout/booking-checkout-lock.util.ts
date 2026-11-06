import { type PrismaService } from 'src/infra/db/prisma/prisma.service';

function hashBookingIdToLockKey(bookingId: string): bigint {
  let hash = 0n;

  for (let index = 0; index < bookingId.length; index++) {
    hash = (hash * 131n + BigInt(bookingId.charCodeAt(index))) % 9_223_372_036_854_775_807n;
  }

  return hash;
}

export async function withBookingCheckoutLock<T>(
  prisma: PrismaService,
  bookingId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const lockKey = hashBookingIdToLockKey(bookingId);

  await prisma.$executeRaw`SELECT pg_advisory_lock(${lockKey})`;

  try {
    return await fn();
  } finally {
    await prisma.$executeRaw`SELECT pg_advisory_unlock(${lockKey})`;
  }
}
