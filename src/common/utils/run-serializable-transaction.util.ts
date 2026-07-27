import { Prisma } from '@prisma/client';
import { type PrismaService } from 'src/infra/db/prisma/prisma.service';

const DEFAULT_MAX_RETRIES = 2;

/**
 * Runs `fn` inside a Serializable-isolation transaction, retrying on Postgres
 * serialization failures (Prisma error code P2034).
 *
 * Serializable isolation turns "read current state, then write based on it"
 * sequences into all-or-nothing operations across concurrent transactions:
 * Postgres aborts one side with a serialization failure instead of letting
 * both succeed and violate an invariant that spans multiple rows (e.g. "at
 * most one primary record per user", "no two unread duplicates").
 */
export async function runSerializableTransaction<T>(
  prisma: PrismaService,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  retriesLeft = DEFAULT_MAX_RETRIES,
): Promise<T> {
  try {
    return await prisma.$transaction(fn, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  } catch (error) {
    const isSerializationConflict =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';

    if (!isSerializationConflict || retriesLeft <= 0) {
      throw error;
    }

    return runSerializableTransaction(prisma, fn, retriesLeft - 1);
  }
}
