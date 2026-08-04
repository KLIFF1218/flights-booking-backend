import { Currency, Prisma, TravelClass } from '@prisma/client';
import { computeSeatPrice } from '../../../src/shared/pricing/seat-fee.catalog';
import { buildFlightFaresFromAdultPrices } from '../../../src/modules/flights/utils/flight-fare-builder.util';
import type { SeedPrisma } from './prisma-client';

const FARE_MULTIPLIERS: Record<TravelClass, number> = {
  ECONOMY: 1,
  PREMIUM_ECONOMY: 1.6,
  BUSINESS: 2.8,
  FIRST: 4.5,
};

const AIRLINES_WITH_FIRST = new Set(['BA', 'LH', 'EK']);

const INSTANCE_BATCH_SIZE = 50;
const SEAT_BATCH_SIZE = 5000;
const FARE_BATCH_SIZE = 3000;

export type SeatTemplate = {
  number: string;
  x: number;
  y: number;
  deck: number;
  seatType: 'WINDOW' | 'AISLE' | 'MIDDLE';
  travelClass: TravelClass;
  isExitRow: boolean;
  isExtraLegroom: boolean;
  isPremium: boolean;
};

export type InstancePlan = {
  flightId: string;
  aircraftId: string;
  departureDate: Date;
  seatsAvailable: number;
  basePriceUsd: number;
  airlineCode: string;
  seatTemplates: SeatTemplate[];
};

export async function clearFlightOperationalData(prisma: SeedPrisma) {
  await prisma.seatHold.deleteMany();
  await prisma.seatAssignment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.traveler.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.flightSeat.deleteMany();
  await prisma.flightFare.deleteMany();
  await prisma.flightInstance.deleteMany();
  await prisma.flightSegment.deleteMany();
  await prisma.flight.deleteMany();
}

export async function clearFlightInstancesOnly(prisma: SeedPrisma) {
  await prisma.seatHold.deleteMany();
  await prisma.seatAssignment.deleteMany();
  await prisma.flightSeat.deleteMany();
  await prisma.flightFare.deleteMany();
  await prisma.flightInstance.deleteMany();
}

function buildFareRows(
  instanceId: string,
  basePriceUsd: number,
  airlineCode: string,
): Prisma.FlightFareCreateManyInput[] {
  const adultPrices = {
    economy: +(basePriceUsd * FARE_MULTIPLIERS.ECONOMY).toFixed(2),
    premiumEconomy: +(basePriceUsd * FARE_MULTIPLIERS.PREMIUM_ECONOMY).toFixed(2),
    business: +(basePriceUsd * FARE_MULTIPLIERS.BUSINESS).toFixed(2),
    ...(AIRLINES_WITH_FIRST.has(airlineCode)
      ? { first: +(basePriceUsd * FARE_MULTIPLIERS.FIRST).toFixed(2) }
      : {}),
  };

  return buildFlightFaresFromAdultPrices({
    instanceId,
    currency: Currency.USD,
    airlineCode,
    adultPrices,
  });
}

const seatRowsCache = new Map<
  string,
  Omit<Prisma.FlightSeatCreateManyInput, 'flightInstanceId'>[]
>();

function getSeatRowsForTemplate(seatTemplates: SeatTemplate[]) {
  const cacheKey = seatTemplates.map((seat) => seat.number).join('|');

  if (!seatRowsCache.has(cacheKey)) {
    seatRowsCache.set(
      cacheKey,
      seatTemplates.map((seat) => ({
        seatNumber: seat.number,
        x: seat.x,
        y: seat.y,
        deck: seat.deck,
        seatType: seat.seatType,
        travelClass: seat.travelClass,
        isExitRow: seat.isExitRow,
        isExtraLegroom: seat.isExtraLegroom,
        isPremium: seat.isPremium,
        price: computeSeatPrice({
          seatType: seat.seatType,
          isExitRow: seat.isExitRow,
          isExtraLegroom: seat.isExtraLegroom,
          isPremium: seat.isPremium,
          travelClass: seat.travelClass,
        }),
      })),
    );
  }

  return seatRowsCache.get(cacheKey)!;
}

function buildSeatRows(
  instanceId: string,
  seatTemplates: SeatTemplate[],
): Prisma.FlightSeatCreateManyInput[] {
  return getSeatRowsForTemplate(seatTemplates).map((seat) => ({
    flightInstanceId: instanceId,
    ...seat,
  }));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

async function insertManyInChunks<T>(
  items: T[],
  batchSize: number,
  insert: (batch: T[]) => Promise<void>,
) {
  for (const batch of chunk(items, batchSize)) {
    await insert(batch);
  }
}

export async function createFlightInstanceBundle(
  prisma: SeedPrisma,
  params: Omit<InstancePlan, never>,
) {
  const instance = await prisma.flightInstance.create({
    data: {
      flightId: params.flightId,
      aircraftId: params.aircraftId,
      departureDate: params.departureDate,
      seatsAvailable: params.seatsAvailable,
    },
  });

  const fares = buildFareRows(instance.id, params.basePriceUsd, params.airlineCode);
  await prisma.flightFare.createMany({ data: fares });

  const seats = buildSeatRows(instance.id, params.seatTemplates);
  if (seats.length > 0) {
    await prisma.flightSeat.createMany({ data: seats });
  }

  return instance;
}

export async function seedFlightInstancesBatched(
  prisma: SeedPrisma,
  plans: InstancePlan[],
  options?: { onProgress?: (created: number, total: number) => void },
) {
  seatRowsCache.clear();

  let createdInstances = 0;
  const total = plans.length;

  for (const planBatch of chunk(plans, INSTANCE_BATCH_SIZE)) {
    const instances = await prisma.flightInstance.createManyAndReturn({
      data: planBatch.map((plan) => ({
        flightId: plan.flightId,
        aircraftId: plan.aircraftId,
        departureDate: plan.departureDate,
        seatsAvailable: plan.seatsAvailable,
      })),
    });

    const fareRows: Prisma.FlightFareCreateManyInput[] = [];
    const seatRows: Prisma.FlightSeatCreateManyInput[] = [];

    for (let i = 0; i < instances.length; i++) {
      const plan = planBatch[i];
      const instance = instances[i];

      fareRows.push(...buildFareRows(instance.id, plan.basePriceUsd, plan.airlineCode));
      seatRows.push(...buildSeatRows(instance.id, plan.seatTemplates));
    }

    await insertManyInChunks(fareRows, FARE_BATCH_SIZE, async (batch) => {
      await prisma.flightFare.createMany({ data: batch });
    });

    await insertManyInChunks(seatRows, SEAT_BATCH_SIZE, async (batch) => {
      await prisma.flightSeat.createMany({ data: batch });
    });

    createdInstances += instances.length;
    options?.onProgress?.(createdInstances, total);
  }

  return createdInstances;
}
