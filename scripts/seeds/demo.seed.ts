import { seedAirlines } from './airlines.seed';
import { seedAirports } from './airports.seed';
import { seedAircraft } from './aircrafts.seed';
import { refreshAircraftLayouts } from './refresh-aircraft-layouts.seed';
import { seedSeatTemplates } from './seat-templates.seed';
import { cleanupOverlappingFacilities } from './cleanup-facilities.seed';
import { seedFlightsAndSegments } from './flights.seed';
import { seedFlightInstances } from './flights-instances.seed';
import { DEMO_DAYS, DEMO_ROUTES } from './config/demo-routes.config';
import { createPrismaClient } from './lib/prisma-client';
import { runSeedMain } from './lib/run-if-main';

const prisma = createPrismaClient();

function resolveDemoSearchCurrency(): 'USD' | 'RUB' {
  return process.env.PAYMENT_PROVIDER_DEFAULT === 'YOOKASSA' ? 'RUB' : 'USD';
}

function resolveDemoPaymentProvider(): string {
  return process.env.PAYMENT_PROVIDER_DEFAULT ?? 'STRIPE';
}

async function runStep(name: string, fn: () => Promise<void>) {
  console.log(`\n▶ ${name}`);
  await fn();
}

function formatDemoDate(daysAhead: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

export async function seedDemoDataset() {
  await runStep('Airlines', seedAirlines);
  await runStep('Airports', seedAirports);
  await runStep('Aircraft', seedAircraft);
  await runStep('Aircraft layouts', refreshAircraftLayouts);
  await runStep('Seat templates', seedSeatTemplates);
  await runStep('Cleanup overlapping facilities', cleanupOverlappingFacilities);
  await runStep('Flights & segments (demo)', async () => {
    await seedFlightsAndSegments({ clean: true, routes: DEMO_ROUTES });
  });
  await runStep('Flight instances (demo)', async () => {
    await seedFlightInstances({ routes: DEMO_ROUTES });
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [flights, instances, seats, jfkSfoInstances] = await Promise.all([
    prisma.flight.count(),
    prisma.flightInstance.count(),
    prisma.flightSeat.count(),
    prisma.flightInstance.count({
      where: {
        departureDate: { gte: today },
        flight: {
          departureAirport: { iataCode: 'JFK' },
          arrivalAirport: { iataCode: 'SFO' },
        },
      },
    }),
  ]);

  console.log('\n📊 Demo summary');
  console.log(`   Route: JFK → SFO (Delta)`);
  console.log(`   Horizon: ${DEMO_DAYS} days`);
  console.log(`   Flight templates: ${flights}`);
  console.log(`   Instances: ${instances}`);
  console.log(`   Seats: ${seats}`);
  console.log(`   Upcoming JFK→SFO instances: ${jfkSfoInstances}`);
  console.log(`   Default payment provider: ${resolveDemoPaymentProvider()}`);
  console.log(`   Default search currency: ${resolveDemoSearchCurrency()}`);
  console.log(`   Try search: POST /v1/flights/search`);
  console.log(
    `     { directions: [{ origin: "JFK", destination: "SFO", dateFrom: "${formatDemoDate(1)}" }], passengers: { adults: 1 }, travelClass: "ECONOMY", currencyCode: "${resolveDemoSearchCurrency()}" }`,
  );

  if (jfkSfoInstances < 1) {
    throw new Error('Demo seed failed: no upcoming JFK→SFO flight instances for search');
  }
}

async function main() {
  await seedDemoDataset();
}

runSeedMain(main, () => prisma.$disconnect(), 'demo.seed');
