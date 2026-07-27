import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { runSeedMain } from './lib/run-if-main';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

export async function cleanupOverlappingFacilities() {
  const result = await prisma.$executeRaw`
    DELETE FROM "FacilityTemplate" ft
    USING "SeatTemplate" st
    WHERE ft."layoutId" = st."layoutId"
      AND ft.x = st.x
      AND ft.y = st.y
  `;

  console.log(`✅ Removed ${result} overlapping facility templates`);
}

async function main() {
  await cleanupOverlappingFacilities();
}

runSeedMain(main, () => prisma.$disconnect());
