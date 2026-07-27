import { seedAirlines } from './airlines.seed';
import { seedAirports } from './airports.seed';
import { seedAircraft } from './aircrafts.seed';
import { refreshAircraftLayouts } from './refresh-aircraft-layouts.seed';
import { seedSeatTemplates } from './seat-templates.seed';
import { cleanupOverlappingFacilities } from './cleanup-facilities.seed';
import { seedFlightsAndSegments } from './flights.seed';
import { seedFlightInstances } from './flights-instances.seed';
import { createPrismaClient } from './lib/prisma-client';
import { runSeedMain } from './lib/run-if-main';

const prisma = createPrismaClient();

async function runStep(name: string, fn: () => Promise<void>) {
  console.log(`\n▶ ${name}`);
  await fn();
}

export async function seedFullDataset() {
  await runStep('Airlines', async () => {
    await seedAirlines();
  });

  await runStep('Airports', async () => {
    await seedAirports();
  });

  await runStep('Aircraft', async () => {
    await seedAircraft();
  });

  await runStep('Aircraft layouts', async () => {
    await refreshAircraftLayouts();
  });

  await runStep('Seat templates', async () => {
    await seedSeatTemplates();
  });

  await runStep('Cleanup overlapping facilities', async () => {
    await cleanupOverlappingFacilities();
  });

  await runStep('Flights & segments', async () => {
    await seedFlightsAndSegments({ clean: true });
  });

  await runStep('Flight instances (fares + seats)', async () => {
    await seedFlightInstances();
  });

  const [flights, instances, jfkSfo] = await Promise.all([
    prisma.flight.count(),
    prisma.flightInstance.count(),
    prisma.flight.count({
      where: {
        departureAirport: { iataCode: 'JFK' },
        arrivalAirport: { iataCode: 'SFO' },
      },
    }),
  ]);

  console.log('\n📊 Summary');
  console.log(`   Flights: ${flights}`);
  console.log(`   Instances: ${instances}`);
  console.log(`   JFK→SFO flight templates: ${jfkSfo} (×30 days each)`);
}

async function main() {
  await seedFullDataset();
}

runSeedMain(main, () => prisma.$disconnect(), 'full.seed');
