import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { getGridWidth } from './generators/seat-generator';
import { runSeedMain } from './lib/run-if-main';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

const layouts: Record<string, { seatsPerRow: number; length: number }> = {
  'A220-300': { seatsPerRow: 5, length: 28 },
  'A320-214': { seatsPerRow: 6, length: 30 },
  A320neo: { seatsPerRow: 6, length: 30 },
  'A321-211': { seatsPerRow: 6, length: 37 },
  A321neo: { seatsPerRow: 6, length: 37 },
  '737-800': { seatsPerRow: 6, length: 30 },
  '737 MAX 8': { seatsPerRow: 6, length: 31 },
  '737 MAX 9': { seatsPerRow: 6, length: 34 },
  'A330-900neo': { seatsPerRow: 8, length: 38 },
  'A350-900': { seatsPerRow: 9, length: 35 },
  'A350-1000': { seatsPerRow: 9, length: 40 },
  '777-300ER': { seatsPerRow: 10, length: 40 },
  '787-9 Dreamliner': { seatsPerRow: 9, length: 34 },
  '747-8': { seatsPerRow: 10, length: 42 },
  'A380-800': { seatsPerRow: 10, length: 58 },
};

export async function refreshAircraftLayouts() {
  const aircraft = await prisma.aircraft.findMany();
  let updated = 0;

  for (const plane of aircraft) {
    if (!plane.name) continue;

    let config;

    for (const [model, value] of Object.entries(layouts)) {
      if (plane.name.includes(model)) {
        config = value;
        break;
      }
    }

    if (!config) continue;

    await prisma.aircraftLayout.upsert({
      where: { aircraftId: plane.id },
      create: {
        aircraftId: plane.id,
        width: getGridWidth(config.seatsPerRow),
        length: config.length,
      },
      update: {
        width: getGridWidth(config.seatsPerRow),
        length: config.length,
      },
    });

    updated++;
  }

  console.log(`✅ Aircraft layouts refreshed (${updated})`);
}

async function main() {
  await refreshAircraftLayouts();
}

runSeedMain(main, () => prisma.$disconnect());
