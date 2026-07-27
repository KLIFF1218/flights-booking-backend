import { Currency, PassengerType, TravelClass, type Traveler } from '@prisma/client';
import { buildEticketDocumentData, allocateSeatSurcharge } from './eticket-document.util';
import type { BookingSnapshot } from 'src/modules/bookings/interfaces/booking-snapshot.interface';

const traveler = {
  id: 'trav-1',
  bookingId: 'booking-1',
  firstName: 'Ivan',
  lastName: 'Petrov',
  gender: 'MALE',
  birthDate: new Date('1990-05-12'),
  nationality: 'RU',
  birthPlace: null,
  passportNumber: '1234567890',
  passportIssuanceDate: new Date('2020-01-01'),
  passportExpiry: new Date('2030-01-01'),
  email: 'ivan@example.com',
  phoneCountryCode: '+7',
  phoneNumber: '9000000000',
  passengerType: PassengerType.ADULT,
  accompanyingTravelerId: null,
  basePrice: 8000,
  currency: Currency.RUB,
  travelClass: TravelClass.ECONOMY,
  fareBasis: 'ECONOMY',
  checkedBags: 1,
  createdAt: new Date(),
};

const snapshot = {
  offer: {
    id: 'offer-1',
    numberOfBookableSeats: 9,
    price: {
      total: '10000',
      currency: 'RUB',
      base: '8000',
      grandTotal: '10000',
    },
    itineraries: [
      {
        duration: 'PT5H',
        segments: [
          {
            id: 'seg-1',
            flightInstanceId: 'fi-1',
            from: 'SVO',
            to: 'IST',
            departure: { iataCode: 'SVO', at: '2026-08-01T10:00:00.000Z' },
            arrival: { iataCode: 'IST', at: '2026-08-01T13:00:00.000Z' },
            carrierCode: 'SU',
            number: '100',
            airline: 'Aeroflot',
            airlineIata: 'SU',
            aircraft: '320',
            operating: { carrierCode: 'SU' },
            duration: 'PT3H',
            blacklistedInEU: false,
          },
          {
            id: 'seg-2',
            flightInstanceId: 'fi-2',
            from: 'IST',
            to: 'CDG',
            departure: { iataCode: 'IST', at: '2026-08-01T15:00:00.000Z' },
            arrival: { iataCode: 'CDG', at: '2026-08-01T18:00:00.000Z' },
            carrierCode: 'TK',
            number: '200',
            airline: 'Turkish Airlines',
            airlineIata: 'TK',
            aircraft: '789',
            operating: { carrierCode: 'TK' },
            duration: 'PT3H',
            blacklistedInEU: false,
          },
        ],
      },
      {
        duration: 'PT3H',
        segments: [
          {
            id: 'seg-3',
            flightInstanceId: 'fi-3',
            from: 'CDG',
            to: 'SVO',
            departure: { iataCode: 'CDG', at: '2026-08-10T09:00:00.000Z' },
            arrival: { iataCode: 'SVO', at: '2026-08-10T14:00:00.000Z' },
            carrierCode: 'SU',
            number: '101',
            airline: 'Aeroflot',
            airlineIata: 'SU',
            aircraft: '320',
            operating: { carrierCode: 'SU' },
            duration: 'PT3H',
            blacklistedInEU: false,
          },
        ],
      },
    ],
    travelerPricings: [],
  },
  pricing: {
    id: 'pricing-1',
    price: {
      base: 8000,
      taxes: 1500,
      fees: 500,
      taxItems: [{ code: 'YQ', amount: '1000.00' }],
      feeItems: [{ type: 'SERVICE_FEE', amount: '500.00' }],
      seats: 0,
      total: 10000,
      currency: 'RUB',
    },
    travelers: [
      {
        travelerId: '1',
        fareOption: 'STANDARD',
        travelerType: PassengerType.ADULT,
        price: {
          currency: 'RUB',
          total: '10000.00',
          base: '8000.00',
          taxes: [{ code: 'YQ', amount: '1500.00' }],
          fees: [{ type: 'SERVICE_FEE', amount: '500.00' }],
        },
        fareDetailsBySegment: [
          {
            segmentId: 'seg-1',
            cabin: TravelClass.ECONOMY,
            class: 'Y',
            fareBasis: 'ECONOMY',
            includedCheckedBags: { quantity: 1 },
            brandName: null,
          },
          {
            segmentId: 'seg-2',
            cabin: TravelClass.ECONOMY,
            class: 'Y',
            fareBasis: 'ECONOMY',
            includedCheckedBags: { quantity: 1 },
            brandName: null,
          },
          {
            segmentId: 'seg-3',
            cabin: TravelClass.ECONOMY,
            class: 'Y',
            fareBasis: 'ECONOMY',
            includedCheckedBags: { quantity: 1 },
            brandName: null,
          },
        ],
      },
    ],
    outbound: {
      from: 'SVO',
      to: 'CDG',
      departureTime: '2026-08-01T10:00:00.000Z',
      arrivalTime: '2026-08-01T18:00:00.000Z',
      durationMinutes: 300,
      stops: 1,
      segments: [],
    },
    inbound: {
      from: 'CDG',
      to: 'SVO',
      departureTime: '2026-08-10T09:00:00.000Z',
      arrivalTime: '2026-08-10T14:00:00.000Z',
      durationMinutes: 180,
      stops: 0,
      segments: [],
    },
  },
} as unknown as BookingSnapshot;

describe('buildEticketDocumentData', () => {
  it('builds a full itinerary receipt with all segments and fare details', () => {
    const document = buildEticketDocumentData({
      pnr: 'ABC123',
      ticketNumber: '555-1234567890',
      issuedAt: new Date('2026-07-19T10:00:00.000Z'),
      traveler: traveler as unknown as Traveler,
      snapshot,
      travelerPricing: snapshot.pricing.travelers[0],
      seatBySegmentId: new Map([
        ['seg-1', '12A'],
        ['seg-3', '14C'],
      ]),
    });

    expect(document.passengerName).toBe('PETROV/IVAN');
    expect(document.origin).toBe('SVO');
    expect(document.destination).toBe('SVO');
    expect(document.segments).toHaveLength(3);
    expect(document.segments[0]).toMatchObject({
      itineraryLabel: 'Outbound',
      flight: 'SU 100',
      seat: '12A',
      fareBasis: 'ECONOMY',
    });
    expect(document.segments[2]).toMatchObject({
      itineraryLabel: 'Return',
      seat: '14C',
    });
    expect(document.fare.seats).toBe('0.00 RUB');
    expect(document.fare.total).toBe('10000.00 RUB');
    expect(document.bookingTotal).toBe('10000.00 RUB');
  });

  it('includes seat surcharge in passenger fare total', () => {
    const pricedSnapshot = {
      ...snapshot,
      pricing: {
        ...snapshot.pricing,
        price: {
          ...snapshot.pricing.price,
          seats: 3330,
          total: 13330,
        },
      },
    } as unknown as BookingSnapshot;

    const document = buildEticketDocumentData({
      pnr: 'ABC123',
      ticketNumber: '555-1234567890',
      issuedAt: new Date('2026-07-19T10:00:00.000Z'),
      traveler: traveler as unknown as Traveler,
      snapshot: pricedSnapshot,
      travelerPricing: snapshot.pricing.travelers[0],
      seatBySegmentId: new Map([['seg-1', '1F']]),
      seatSurcharge: 3330,
    });

    expect(document.fare.seats).toBe('3330.00 RUB');
    expect(document.fare.total).toBe('13330.00 RUB');
    expect(document.bookingTotal).toBe('13330.00 RUB');
  });
});

describe('allocateSeatSurcharge', () => {
  it('returns zero when booking has no seat surcharge', () => {
    expect(
      allocateSeatSurcharge({
        bookingSeatsTotal: 0,
        travelerSeatCount: 2,
        bookingSeatAssignmentTotal: 2,
      }),
    ).toBe(0);
  });

  it('allocates seat surcharge proportionally by seat assignment count', () => {
    expect(
      allocateSeatSurcharge({
        bookingSeatsTotal: 300,
        travelerSeatCount: 2,
        bookingSeatAssignmentTotal: 3,
      }),
    ).toBe(200);
    expect(
      allocateSeatSurcharge({
        bookingSeatsTotal: 300,
        travelerSeatCount: 1,
        bookingSeatAssignmentTotal: 3,
      }),
    ).toBe(100);
  });

  it('returns zero when traveler has no seat assignments', () => {
    expect(
      allocateSeatSurcharge({
        bookingSeatsTotal: 500,
        travelerSeatCount: 0,
        bookingSeatAssignmentTotal: 2,
      }),
    ).toBe(0);
  });
});
