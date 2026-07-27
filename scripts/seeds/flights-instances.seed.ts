import type { RouteSeedConfig } from './config/routes.config';
import { ALL_ROUTES } from './config/routes.config';
import { departureDateForDay, generateAllFlights } from './generators/flights.generator';
import {
  clearFlightInstancesOnly,
  seedFlightInstancesBatched,
  type InstancePlan,
} from './lib/flight-instance-builder';
import { computeInstancePriceUsd } from './lib/pricing.util';
import { createPrismaClient } from './lib/prisma-client';
import { runSeedMain } from './lib/run-if-main';

const prisma = createPrismaClient();

export async function seedFlightInstances(options?: { routes?: RouteSeedConfig[] }) {
  const startedAt = Date.now();
  const routes = options?.routes ?? ALL_ROUTES;
  const generatedFlights = generateAllFlights(routes);
  const flightMeta = new Map(generatedFlights.map((flight) => [flight.flightNumber, flight]));

  const flights = await prisma.flight.findMany({
    include: {
      airline: true,
      segments: {
        include: {
          aircraft: {
            include: {
              aircraftLayout: {
                include: {
                  seats: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const plans: InstancePlan[] = [];
  let skipped = 0;

  for (const flight of flights) {
    const segment = flight.segments[0];
    const meta = flightMeta.get(flight.flightNumber);

    if (!segment?.aircraft?.aircraftLayout) {
      console.warn(`Skip instances for ${flight.flightNumber}: no aircraft layout`);
      skipped++;
      continue;
    }

    const seatTemplates = segment.aircraft.aircraftLayout.seats;
    const seatsAvailable = seatTemplates.length;
    const days = meta?.days ?? 30;

    for (let day = 0; day < days; day++) {
      plans.push({
        flightId: flight.id,
        aircraftId: segment.aircraft.id,
        departureDate: departureDateForDay(today, day, segment.departureTime),
        seatsAvailable,
        seatTemplates,
        basePriceUsd: computeInstancePriceUsd(meta?.basePriceUsd ?? 300, day),
        airlineCode: flight.airline.code,
      });
    }
  }

  console.log(`📦 Prepared ${plans.length} instance plans`);

  await clearFlightInstancesOnly(prisma);

  const createdInstances = await seedFlightInstancesBatched(prisma, plans, {
    onProgress: (created, total) => {
      const percent = Math.round((created / total) * 100);
      console.log(`... ${created}/${total} instances (${percent}%)`);
    },
  });

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(`✅ Flight instances seeded (${createdInstances}) in ${elapsedSec}s`);
  if (skipped > 0) {
    console.log(`⚠️ Skipped ${skipped} flights without layout`);
  }
}

async function main() {
  await seedFlightInstances();
}

runSeedMain(main, () => prisma.$disconnect(), 'flights-instances.seed');
