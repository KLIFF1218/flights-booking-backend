import type { RouteSeedConfig } from './config/routes.config';
import { ALL_ROUTES } from './config/routes.config';
import { generateAllFlights } from './generators/flights.generator';
import { createPrismaClient } from './lib/prisma-client';
import { clearFlightOperationalData } from './lib/flight-instance-builder';
import { runSeedMain } from './lib/run-if-main';

const prisma = createPrismaClient();

export async function seedFlightsAndSegments(options?: {
  clean?: boolean;
  routes?: RouteSeedConfig[];
}) {
  if (options?.clean) {
    console.log('🧹 Cleaning existing flights...');
    await clearFlightOperationalData(prisma);
  }

  const routes = options?.routes ?? ALL_ROUTES;
  const airports = await prisma.airport.findMany();
  const airlines = await prisma.airline.findMany();
  const aircraft = await prisma.aircraft.findMany();

  const airportMap = Object.fromEntries(airports.map((item) => [item.iataCode, item.id]));
  const airlineMap = Object.fromEntries(airlines.map((item) => [item.code, item.id]));
  const aircraftMap = Object.fromEntries(aircraft.map((item) => [item.code, item.id]));

  const generated = generateAllFlights(routes);
  let createdFlights = 0;
  let createdSegments = 0;

  for (const flight of generated) {
    const departureAirportId = airportMap[flight.from];
    const arrivalAirportId = airportMap[flight.to];
    const airlineId = airlineMap[flight.airlineCode];
    const aircraftId = aircraftMap[flight.aircraftCode];

    if (!departureAirportId || !arrivalAirportId || !airlineId) {
      console.warn(`Skip ${flight.flightNumber}: missing airport or airline`);
      continue;
    }

    if (!aircraftId) {
      console.warn(`Skip ${flight.flightNumber}: aircraft ${flight.aircraftCode} not found`);
      continue;
    }

    const created = await prisma.flight.create({
      data: {
        airlineId,
        flightNumber: flight.flightNumber,
        departureAirportId,
        arrivalAirportId,
        durationMinutes: flight.durationMinutes,
        segments: {
          create: {
            segmentOrder: 1,
            dayOffset: 0,
            departureAirportId,
            arrivalAirportId,
            departureTime: flight.departureTime,
            arrivalTime: flight.arrivalTime,
            carrierCode: flight.airlineCode,
            flightNumber: flight.flightNumber,
            aircraftId,
            durationMinutes: flight.durationMinutes,
          },
        },
      },
    });

    createdFlights++;
    createdSegments++;
  }

  console.log(`✅ Flights seeded (${createdFlights})`);
  console.log(`✅ Flight segments seeded (${createdSegments})`);
}

async function main() {
  await seedFlightsAndSegments({ clean: true });
}

runSeedMain(main, () => prisma.$disconnect(), 'flights.seed');
