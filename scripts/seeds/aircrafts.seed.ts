import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { runSeedMain } from './lib/run-if-main';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

export async function seedAircraft() {
  const airlines = await prisma.airline.findMany();

  const airlineMap = Object.fromEntries(airlines.map((airline) => [airline.code, airline.id]));

  await prisma.aircraft.createMany({
    skipDuplicates: true,
    data: [
      {
        code: 'SU-A320',
        name: 'Airbus A320-214',
        airlineId: airlineMap.SU,
      },
      {
        code: 'SU-A321',
        name: 'Airbus A321-211',
        airlineId: airlineMap.SU,
      },
      {
        code: 'SU-A359',
        name: 'Airbus A350-900',
        airlineId: airlineMap.SU,
      },
      {
        code: 'SU-B738',
        name: 'Boeing 737-800',
        airlineId: airlineMap.SU,
      },

      {
        code: 'TK-A21N',
        name: 'Airbus A321neo',
        airlineId: airlineMap.TK,
      },
      {
        code: 'TK-B789',
        name: 'Boeing 787-9 Dreamliner',
        airlineId: airlineMap.TK,
      },
      {
        code: 'TK-B77W',
        name: 'Boeing 777-300ER',
        airlineId: airlineMap.TK,
      },

      {
        code: 'LH-A20N',
        name: 'Airbus A320neo',
        airlineId: airlineMap.LH,
      },
      {
        code: 'LH-A359',
        name: 'Airbus A350-900',
        airlineId: airlineMap.LH,
      },
      {
        code: 'LH-B748',
        name: 'Boeing 747-8',
        airlineId: airlineMap.LH,
      },

      {
        code: 'AF-A359',
        name: 'Airbus A350-900',
        airlineId: airlineMap.AF,
      },
      {
        code: 'AF-B789',
        name: 'Boeing 787-9 Dreamliner',
        airlineId: airlineMap.AF,
      },

      {
        code: 'BA-A35K',
        name: 'Airbus A350-1000',
        airlineId: airlineMap.BA,
      },
      {
        code: 'BA-B789',
        name: 'Boeing 787-9 Dreamliner',
        airlineId: airlineMap.BA,
      },

      {
        code: 'KL-B738',
        name: 'Boeing 737-800',
        airlineId: airlineMap.KL,
      },
      {
        code: 'KL-B789',
        name: 'Boeing 787-9 Dreamliner',
        airlineId: airlineMap.KL,
      },

      {
        code: 'IB-A320',
        name: 'Airbus A320-214',
        airlineId: airlineMap.IB,
      },
      {
        code: 'IB-A359',
        name: 'Airbus A350-900',
        airlineId: airlineMap.IB,
      },

      {
        code: 'AZ-A320',
        name: 'Airbus A320-214',
        airlineId: airlineMap.AZ,
      },
      {
        code: 'AZ-A339',
        name: 'Airbus A330-900neo',
        airlineId: airlineMap.AZ,
      },

      {
        code: 'EK-A388',
        name: 'Airbus A380-800',
        airlineId: airlineMap.EK,
      },
      {
        code: 'EK-B77W',
        name: 'Boeing 777-300ER',
        airlineId: airlineMap.EK,
      },

      {
        code: 'QR-A359',
        name: 'Airbus A350-900',
        airlineId: airlineMap.QR,
      },
      {
        code: 'QR-B789',
        name: 'Boeing 787-9 Dreamliner',
        airlineId: airlineMap.QR,
      },

      {
        code: 'DL-A223',
        name: 'Airbus A220-300',
        airlineId: airlineMap.DL,
      },
      {
        code: 'DL-A21N',
        name: 'Airbus A321neo',
        airlineId: airlineMap.DL,
      },
      {
        code: 'DL-A339',
        name: 'Airbus A330-900neo',
        airlineId: airlineMap.DL,
      },

      {
        code: 'AA-A21N',
        name: 'Airbus A321neo',
        airlineId: airlineMap.AA,
      },
      {
        code: 'AA-B38M',
        name: 'Boeing 737 MAX 8',
        airlineId: airlineMap.AA,
      },

      {
        code: 'UA-B39M',
        name: 'Boeing 737 MAX 9',
        airlineId: airlineMap.UA,
      },
      {
        code: 'UA-B77W',
        name: 'Boeing 777-300ER',
        airlineId: airlineMap.UA,
      },

      {
        code: 'AS-B39M',
        name: 'Boeing 737 MAX 9',
        airlineId: airlineMap.AS,
      },

      {
        code: 'AC-A223',
        name: 'Airbus A220-300',
        airlineId: airlineMap.AC,
      },
      {
        code: 'AC-B789',
        name: 'Boeing 787-9 Dreamliner',
        airlineId: airlineMap.AC,
      },
    ],
  });

  console.log('✅ Aircraft seeded');
}

async function main() {
  await seedAircraft();
}

runSeedMain(main, () => prisma.$disconnect());
