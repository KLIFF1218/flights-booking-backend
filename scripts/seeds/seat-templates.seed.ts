import { PrismaClient, Prisma, SeatType } from '@prisma/client';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { findSeatsPerRowForGridWidth, generateSeats } from './generators/seat-generator';
import { runSeedMain } from './lib/run-if-main';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

export async function seedSeatTemplates() {
  const aircraftLayouts = await prisma.aircraftLayout.findMany();
  const seats: Prisma.SeatTemplateCreateManyInput[] = [];

  for (const layout of aircraftLayouts) {
    const seatsPerRow = findSeatsPerRowForGridWidth(layout.width);

    if (!seatsPerRow) {
      console.warn(`Skip layout ${layout.id}: unsupported grid width ${layout.width}`);
      continue;
    }

    const generated = generateSeats(seatsPerRow, layout.length);

    for (const seat of generated) {
      seats.push({
        layoutId: layout.id,
        number: seat.number,
        x: seat.x,
        y: seat.y,
        deck: seat.deck,
        seatType: seat.seatType as SeatType,
        isExitRow: seat.isExitRow,
        isExtraLegroom: seat.isExtraLegroom,
        isPremium: seat.isPremium,
      });
    }
  }

  await prisma.seatTemplate.deleteMany();
  await prisma.seatTemplate.createMany({
    data: seats,
  });

  console.log(`✅ Seat templates seeded (${seats.length})`);
}

async function main() {
  await seedSeatTemplates();
}

runSeedMain(main, () => prisma.$disconnect());
