import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

export async function seedFlightSegments() {
  const flights = await prisma.flight.findMany({
    include: {
      departureAirport: true,
      arrivalAirport: true,
      airline: true,
    },
  });

  const aircraft = await prisma.aircraft.findMany();

  const aircraftMap = Object.fromEntries(aircraft.map((a) => [a.code, a.id]));

  const aircraftForFlight: Record<string, string> = {
    SU100: aircraftMap['SU-A359'],
    SU2130: aircraftMap['SU-A321'],
    SU2142: aircraftMap['SU-A321'],
    SU46: aircraftMap['SU-A320'],

    TK1: aircraftMap['TK-B77W'],
    TK79: aircraftMap['TK-B789'],
    TK15: aircraftMap['TK-B77W'],
    TK1661: aircraftMap['TK-A21N'],

    LH400: aircraftMap['LH-B748'],
    LH454: aircraftMap['LH-A359'],
    LH452: aircraftMap['LH-A359'],
    LH96: aircraftMap['LH-A20N'],

    AF6: aircraftMap['AF-B789'],
    AF84: aircraftMap['AF-A359'],

    BA117: aircraftMap['BA-B789'],
    BA287: aircraftMap['BA-A35K'],

    KL641: aircraftMap['KL-B789'],

    IB6253: aircraftMap['IB-A359'],

    AZ610: aircraftMap['AZ-A339'],

    EK205: aircraftMap['EK-A388'],

    QR739: aircraftMap['QR-B789'],

    DL284: aircraftMap['DL-A21N'],
    DL12: aircraftMap['DL-A339'],

    AA177: aircraftMap['AA-A21N'],

    UA863: aircraftMap['UA-B77W'],
    UA154: aircraftMap['UA-B39M'],

    AS21: aircraftMap['AS-B39M'],

    AC851: aircraftMap['AC-B789'],
  };

  const departureTimes: Record<string, string> = {
    SU100: '10:15',
    SU2130: '08:40',
    SU2142: '09:10',
    SU46: '07:30',

    TK1: '08:15',
    TK79: '14:10',
    TK15: '13:20',
    TK1661: '11:00',

    LH400: '13:20',
    LH454: '10:35',
    LH452: '09:50',
    LH96: '08:00',

    AF6: '10:30',
    AF84: '13:10',

    BA117: '11:25',
    BA287: '14:55',

    KL641: '13:40',

    IB6253: '12:10',

    AZ610: '10:20',

    EK205: '02:50',

    QR739: '08:05',

    DL284: '09:15',
    DL12: '11:10',

    AA177: '08:30',

    UA863: '09:00',
    UA154: '14:00',

    AS21: '07:15',

    AC851: '20:15',
  };

  const arrivalTimes: Record<string, string> = {
    SU100: '13:15',
    SU2130: '13:40',
    SU2142: '14:10',
    SU46: '09:00',

    TK1: '11:05',
    TK79: '17:40',
    TK15: '17:00',
    TK1661: '12:10',

    LH400: '16:50',
    LH454: '13:15',
    LH452: '13:50',
    LH96: '08:55',

    AF6: '12:45',
    AF84: '15:40',

    BA117: '14:15',
    BA287: '17:55',

    KL641: '16:40',

    IB6253: '15:30',

    AZ610: '14:50',

    EK205: '08:50',

    QR739: '16:05',

    DL284: '12:45',
    DL12: '14:25',

    AA177: '12:05',

    UA863: '17:30',
    UA154: '15:35',

    AS21: '15:35',

    AC851: '08:20',
  };

  await prisma.flightSegment.createMany({
    skipDuplicates: true,
    data: flights.map((flight) => ({
      flightId: flight.id,

      segmentOrder: 1,
      dayOffset: 0,

      departureAirportId: flight.departureAirportId,
      arrivalAirportId: flight.arrivalAirportId,

      departureTime: departureTimes[flight.flightNumber],
      arrivalTime: arrivalTimes[flight.flightNumber],

      carrierCode: flight.airline.code,
      flightNumber: flight.flightNumber,

      aircraftId: aircraftForFlight[flight.flightNumber],

      durationMinutes: flight.durationMinutes,
    })),
  });

  console.log('✅ Flight segments seeded');
}

async function main() {
  await seedFlightSegments();
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
