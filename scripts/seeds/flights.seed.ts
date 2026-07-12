import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

export async function seedFlights() {
  const airports = await prisma.airport.findMany();
  const airlines = await prisma.airline.findMany();

  const airportMap = Object.fromEntries(airports.map((airport) => [airport.iataCode, airport.id]));

  const airlineMap = Object.fromEntries(airlines.map((airline) => [airline.code, airline.id]));

  await prisma.flight.createMany({
    skipDuplicates: true,
    data: [
      {
        airlineId: airlineMap.SU,
        flightNumber: 'SU100',
        departureAirportId: airportMap.SVO,
        arrivalAirportId: airportMap.JFK,
        durationMinutes: 600,
      },
      {
        airlineId: airlineMap.SU,
        flightNumber: 'SU2130',
        departureAirportId: airportMap.SVO,
        arrivalAirportId: airportMap.IST,
        durationMinutes: 300,
      },
      {
        airlineId: airlineMap.SU,
        flightNumber: 'SU2142',
        departureAirportId: airportMap.SVO,
        arrivalAirportId: airportMap.AYT,
        durationMinutes: 300,
      },
      {
        airlineId: airlineMap.SU,
        flightNumber: 'SU46',
        departureAirportId: airportMap.SVO,
        arrivalAirportId: airportMap.LED,
        durationMinutes: 90,
      },
      {
        airlineId: airlineMap.TK,
        flightNumber: 'TK1',
        departureAirportId: airportMap.IST,
        arrivalAirportId: airportMap.JFK,
        durationMinutes: 650,
      },
      {
        airlineId: airlineMap.TK,
        flightNumber: 'TK79',
        departureAirportId: airportMap.IST,
        arrivalAirportId: airportMap.SFO,
        durationMinutes: 810,
      },
      {
        airlineId: airlineMap.TK,
        flightNumber: 'TK15',
        departureAirportId: airportMap.IST,
        arrivalAirportId: airportMap.LAX,
        durationMinutes: 820,
      },
      {
        airlineId: airlineMap.TK,
        flightNumber: 'TK1661',
        departureAirportId: airportMap.IST,
        arrivalAirportId: airportMap.FRA,
        durationMinutes: 190,
      },

      {
        airlineId: airlineMap.LH,
        flightNumber: 'LH400',
        departureAirportId: airportMap.FRA,
        arrivalAirportId: airportMap.JFK,
        durationMinutes: 510,
      },
      {
        airlineId: airlineMap.LH,
        flightNumber: 'LH454',
        departureAirportId: airportMap.FRA,
        arrivalAirportId: airportMap.SFO,
        durationMinutes: 700,
      },
      {
        airlineId: airlineMap.LH,
        flightNumber: 'LH452',
        departureAirportId: airportMap.FRA,
        arrivalAirportId: airportMap.LAX,
        durationMinutes: 720,
      },
      {
        airlineId: airlineMap.LH,
        flightNumber: 'LH96',
        departureAirportId: airportMap.FRA,
        arrivalAirportId: airportMap.MUC,
        durationMinutes: 55,
      },
      {
        airlineId: airlineMap.AF,
        flightNumber: 'AF6',
        departureAirportId: airportMap.CDG,
        arrivalAirportId: airportMap.JFK,
        durationMinutes: 495,
      },
      {
        airlineId: airlineMap.AF,
        flightNumber: 'AF84',
        departureAirportId: airportMap.CDG,
        arrivalAirportId: airportMap.SFO,
        durationMinutes: 690,
      },
      {
        airlineId: airlineMap.BA,
        flightNumber: 'BA117',
        departureAirportId: airportMap.LHR,
        arrivalAirportId: airportMap.JFK,
        durationMinutes: 470,
      },
      {
        airlineId: airlineMap.BA,
        flightNumber: 'BA287',
        departureAirportId: airportMap.LHR,
        arrivalAirportId: airportMap.SFO,
        durationMinutes: 660,
      },
      {
        airlineId: airlineMap.KL,
        flightNumber: 'KL641',
        departureAirportId: airportMap.AMS,
        arrivalAirportId: airportMap.JFK,
        durationMinutes: 480,
      },
      {
        airlineId: airlineMap.IB,
        flightNumber: 'IB6253',
        departureAirportId: airportMap.MAD,
        arrivalAirportId: airportMap.JFK,
        durationMinutes: 500,
      },
      {
        airlineId: airlineMap.AZ,
        flightNumber: 'AZ610',
        departureAirportId: airportMap.FCO,
        arrivalAirportId: airportMap.JFK,
        durationMinutes: 570,
      },
      {
        airlineId: airlineMap.EK,
        flightNumber: 'EK205',
        departureAirportId: airportMap.DXB,
        arrivalAirportId: airportMap.JFK,
        durationMinutes: 840,
      },
      {
        airlineId: airlineMap.QR,
        flightNumber: 'QR739',
        departureAirportId: airportMap.DOH,
        arrivalAirportId: airportMap.LAX,
        durationMinutes: 960,
      },
      {
        airlineId: airlineMap.DL,
        flightNumber: 'DL284',
        departureAirportId: airportMap.JFK,
        arrivalAirportId: airportMap.SFO,
        durationMinutes: 390,
      },
      {
        airlineId: airlineMap.DL,
        flightNumber: 'DL12',
        departureAirportId: airportMap.JFK,
        arrivalAirportId: airportMap.LAX,
        durationMinutes: 375,
      },
      {
        airlineId: airlineMap.AA,
        flightNumber: 'AA177',
        departureAirportId: airportMap.JFK,
        arrivalAirportId: airportMap.SFO,
        durationMinutes: 395,
      },
      {
        airlineId: airlineMap.UA,
        flightNumber: 'UA863',
        departureAirportId: airportMap.SFO,
        arrivalAirportId: airportMap.JFK,
        durationMinutes: 330,
      },
      {
        airlineId: airlineMap.UA,
        flightNumber: 'UA154',
        departureAirportId: airportMap.SFO,
        arrivalAirportId: airportMap.LAX,
        durationMinutes: 95,
      },
      {
        airlineId: airlineMap.AS,
        flightNumber: 'AS21',
        departureAirportId: airportMap.SEA,
        arrivalAirportId: airportMap.JFK,
        durationMinutes: 320,
      },
      {
        airlineId: airlineMap.AC,
        flightNumber: 'AC851',
        departureAirportId: airportMap.YYZ,
        arrivalAirportId: airportMap.LHR,
        durationMinutes: 425,
      },
    ],
  });

  console.log('✅ Flights seeded');
}

async function main() {
  await seedFlights();
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
