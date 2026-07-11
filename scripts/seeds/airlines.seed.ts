import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

export async function seedAirlines() {
  await prisma.airline.createMany({
    skipDuplicates: true,
    data: [
      {
        code: 'SU',
        name: 'Aeroflot',
      },
      {
        code: 'TK',
        name: 'Turkish Airlines',
      },
      {
        code: 'LH',
        name: 'Lufthansa',
      },
      {
        code: 'AF',
        name: 'Air France',
      },
      {
        code: 'BA',
        name: 'British Airways',
      },
      {
        code: 'KL',
        name: 'KLM',
      },
      {
        code: 'IB',
        name: 'Iberia',
      },
      {
        code: 'AZ',
        name: 'ITA Airways',
      },
      {
        code: 'EK',
        name: 'Emirates',
      },
      {
        code: 'QR',
        name: 'Qatar Airways',
      },
      {
        code: 'DL',
        name: 'Delta Air Lines',
      },
      {
        code: 'AA',
        name: 'American Airlines',
      },
      {
        code: 'UA',
        name: 'United Airlines',
      },
      {
        code: 'AS',
        name: 'Alaska Airlines',
      },
      {
        code: 'AC',
        name: 'Air Canada',
      },
    ],
  });

  console.log('✅ Airlines seeded');
}

async function main() {
  await seedAirlines();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
