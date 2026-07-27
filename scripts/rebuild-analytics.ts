import { PrismaClient } from '@prisma/client';
import { DomainAnalyticsService } from '../src/infra/analytics/domain-analytics.service';

async function main() {
  const prisma = new PrismaClient();
  const logger = {
    log: console.log,
    debug: console.debug,
    warn: console.warn,
    error: console.error,
  };

  const analytics = new DomainAnalyticsService(prisma as never, logger as never);
  const result = await analytics.rebuildFromDomainEvents();

  console.log(`Rebuilt analytics: ${result.applied}/${result.processed} events applied`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
