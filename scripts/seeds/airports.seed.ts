import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

export async function seedAirports() {
  await prisma.airport.createMany({
    skipDuplicates: true,
    data: [
      {
        name: 'Sheremetyevo International Airport',
        city: 'Moscow',
        country: 'Russia',
        timezone: 'Europe/Moscow',
        iataCode: 'SVO',
        icaoCode: 'UUEE',
        latitude: 55.972599,
        longitude: 37.4146,
      },
      {
        name: 'Pulkovo Airport',
        city: 'Saint Petersburg',
        country: 'Russia',
        timezone: 'Europe/Moscow',
        iataCode: 'LED',
        icaoCode: 'ULLI',
        latitude: 59.8003,
        longitude: 30.2625,
      },
      {
        name: 'Istanbul Airport',
        city: 'Istanbul',
        country: 'Turkey',
        timezone: 'Europe/Istanbul',
        iataCode: 'IST',
        icaoCode: 'LTFM',
        latitude: 41.275278,
        longitude: 28.751944,
      },
      {
        name: 'Antalya Airport',
        city: 'Antalya',
        country: 'Turkey',
        timezone: 'Europe/Istanbul',
        iataCode: 'AYT',
        icaoCode: 'LTAI',
        latitude: 36.898701,
        longitude: 30.800501,
      },
      {
        name: 'Frankfurt Airport',
        city: 'Frankfurt',
        country: 'Germany',
        timezone: 'Europe/Berlin',
        iataCode: 'FRA',
        icaoCode: 'EDDF',
        latitude: 50.037933,
        longitude: 8.562152,
      },
      {
        name: 'Munich Airport',
        city: 'Munich',
        country: 'Germany',
        timezone: 'Europe/Berlin',
        iataCode: 'MUC',
        icaoCode: 'EDDM',
        latitude: 48.353802,
        longitude: 11.7861,
      },
      {
        name: 'Charles de Gaulle Airport',
        city: 'Paris',
        country: 'France',
        timezone: 'Europe/Paris',
        iataCode: 'CDG',
        icaoCode: 'LFPG',
        latitude: 49.009701,
        longitude: 2.5479,
      },
      {
        name: 'Paris Orly Airport',
        city: 'Paris',
        country: 'France',
        timezone: 'Europe/Paris',
        iataCode: 'ORY',
        icaoCode: 'LFPO',
        latitude: 48.7262,
        longitude: 2.3652,
      },
      {
        name: 'Heathrow Airport',
        city: 'London',
        country: 'United Kingdom',
        timezone: 'Europe/London',
        iataCode: 'LHR',
        icaoCode: 'EGLL',
        latitude: 51.4706,
        longitude: -0.461941,
      },
      {
        name: 'Gatwick Airport',
        city: 'London',
        country: 'United Kingdom',
        timezone: 'Europe/London',
        iataCode: 'LGW',
        icaoCode: 'EGKK',
        latitude: 51.153702,
        longitude: -0.1821,
      },
      {
        name: 'Amsterdam Airport Schiphol',
        city: 'Amsterdam',
        country: 'Netherlands',
        timezone: 'Europe/Amsterdam',
        iataCode: 'AMS',
        icaoCode: 'EHAM',
        latitude: 52.308601,
        longitude: 4.763889,
      },
      {
        name: 'Adolfo Suárez Madrid–Barajas Airport',
        city: 'Madrid',
        country: 'Spain',
        timezone: 'Europe/Madrid',
        iataCode: 'MAD',
        icaoCode: 'LEMD',
        latitude: 40.4722,
        longitude: -3.56083,
      },
      {
        name: 'Josep Tarradellas Barcelona–El Prat Airport',
        city: 'Barcelona',
        country: 'Spain',
        timezone: 'Europe/Madrid',
        iataCode: 'BCN',
        icaoCode: 'LEBL',
        latitude: 41.2971,
        longitude: 2.07846,
      },
      {
        name: 'Leonardo da Vinci–Fiumicino Airport',
        city: 'Rome',
        country: 'Italy',
        timezone: 'Europe/Rome',
        iataCode: 'FCO',
        icaoCode: 'LIRF',
        latitude: 41.800278,
        longitude: 12.238889,
      },
      {
        name: 'Athens International Airport',
        city: 'Athens',
        country: 'Greece',
        timezone: 'Europe/Athens',
        iataCode: 'ATH',
        icaoCode: 'LGAV',
        latitude: 37.936401,
        longitude: 23.9445,
      },
      {
        name: 'Dubai International Airport',
        city: 'Dubai',
        country: 'United Arab Emirates',
        timezone: 'Asia/Dubai',
        iataCode: 'DXB',
        icaoCode: 'OMDB',
        latitude: 25.252799,
        longitude: 55.364399,
      },
      {
        name: 'Hamad International Airport',
        city: 'Doha',
        country: 'Qatar',
        timezone: 'Asia/Qatar',
        iataCode: 'DOH',
        icaoCode: 'OTHH',
        latitude: 25.273056,
        longitude: 51.608056,
      },
      {
        name: 'John F. Kennedy International Airport',
        city: 'New York',
        country: 'United States',
        timezone: 'America/New_York',
        iataCode: 'JFK',
        icaoCode: 'KJFK',
        latitude: 40.641311,
        longitude: -73.778139,
      },
      {
        name: 'San Francisco International Airport',
        city: 'San Francisco',
        country: 'United States',
        timezone: 'America/Los_Angeles',
        iataCode: 'SFO',
        icaoCode: 'KSFO',
        latitude: 37.621313,
        longitude: -122.378955,
      },
      {
        name: 'Los Angeles International Airport',
        city: 'Los Angeles',
        country: 'United States',
        timezone: 'America/Los_Angeles',
        iataCode: 'LAX',
        icaoCode: 'KLAX',
        latitude: 33.941589,
        longitude: -118.40853,
      },
      {
        name: "O'Hare International Airport",
        city: 'Chicago',
        country: 'United States',
        timezone: 'America/Chicago',
        iataCode: 'ORD',
        icaoCode: 'KORD',
        latitude: 41.974163,
        longitude: -87.907321,
      },
      {
        name: 'Seattle–Tacoma International Airport',
        city: 'Seattle',
        country: 'United States',
        timezone: 'America/Los_Angeles',
        iataCode: 'SEA',
        icaoCode: 'KSEA',
        latitude: 47.450249,
        longitude: -122.308817,
      },
      {
        name: 'Toronto Pearson International Airport',
        city: 'Toronto',
        country: 'Canada',
        timezone: 'America/Toronto',
        iataCode: 'YYZ',
        icaoCode: 'CYYZ',
        latitude: 43.677717,
        longitude: -79.624819,
      },
    ],
  });

  console.log('✅ Airports seeded');
}

async function main() {
  await seedAirports();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
