import { BadRequestException } from '@nestjs/common';
import { PassengerType } from '@prisma/client';
import {
  assertSeatSelectionComplete,
  isSeatSelectionComplete,
  resolveCheckoutSeats,
  resolveSeatingTravelers,
  seatAssignmentsMatchRequest,
  type ExistingSeatAssignment,
} from './booking-seat-selection.util';
import type { BookingSnapshot } from '../interfaces/booking-snapshot.interface';
import type { AssignSeatDto } from '../dtos/add-seats.dto';

describe('seatAssignmentsMatchRequest', () => {
  const assignments: ExistingSeatAssignment[] = [
    {
      travelerId: 'trav-1',
      segmentId: 'seg-out',
      seat: { seatNumber: '1A' },
    },
    {
      travelerId: 'trav-1',
      segmentId: 'seg-in',
      seat: { seatNumber: '2A' },
    },
  ];

  it('returns true when requested seats match existing assignments', () => {
    const seats: AssignSeatDto[] = [
      { travelerId: 'trav-1', segmentId: 'seg-in', seatNumber: '2A' },
      { travelerId: 'trav-1', segmentId: 'seg-out', seatNumber: '1A' },
    ];

    expect(seatAssignmentsMatchRequest(seats, assignments)).toBe(true);
  });

  it('returns false when seat selection changed', () => {
    const seats: AssignSeatDto[] = [
      { travelerId: 'trav-1', segmentId: 'seg-out', seatNumber: '3C' },
    ];

    expect(seatAssignmentsMatchRequest(seats, assignments)).toBe(false);
  });
});

const snapshot = {
  offer: {
    itineraries: [
      {
        segments: [{ id: 'seg-out', flightInstanceId: 'fi-out' }],
      },
      {
        segments: [{ id: 'seg-in', flightInstanceId: 'fi-in' }],
      },
    ],
  },
  pricing: {
    travelers: [
      { travelerId: 'trav-1', travelerType: PassengerType.ADULT },
      { travelerId: 'trav-2', travelerType: PassengerType.CHILD },
      { travelerId: 'trav-3', travelerType: PassengerType.HELD_INFANT },
    ],
  },
} as unknown as BookingSnapshot;

const travelers = [
  { id: 'trav-1', passengerType: PassengerType.ADULT },
  { id: 'trav-2', passengerType: PassengerType.CHILD },
  { id: 'trav-3', passengerType: PassengerType.HELD_INFANT },
];

describe('assertSeatSelectionComplete', () => {
  it('accepts a full seat map for all seating travelers and segments', () => {
    expect(() =>
      assertSeatSelectionComplete(
        snapshot,
        [
          { travelerId: 'trav-1', segmentId: 'seg-out', seatNumber: '1A' },
          { travelerId: 'trav-2', segmentId: 'seg-out', seatNumber: '1B' },
          { travelerId: 'trav-1', segmentId: 'seg-in', seatNumber: '2A' },
          { travelerId: 'trav-2', segmentId: 'seg-in', seatNumber: '2B' },
        ],
        travelers,
      ),
    ).not.toThrow();
  });

  it('rejects partial seat selection', () => {
    expect(() =>
      assertSeatSelectionComplete(
        snapshot,
        [{ travelerId: 'trav-1', segmentId: 'seg-out', seatNumber: '1A' }],
        travelers,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects seat assignment for lap infant', () => {
    expect(() =>
      assertSeatSelectionComplete(
        snapshot,
        [{ travelerId: 'trav-3', segmentId: 'seg-out', seatNumber: '1C' }],
        travelers,
      ),
    ).toThrow('does not require a seat');
  });
});

describe('resolveCheckoutSeats', () => {
  it('falls back to persisted assignments when request seats are empty', () => {
    expect(
      resolveCheckoutSeats(
        [],
        [
          {
            travelerId: 'trav-1',
            segmentId: 'seg-1',
            seat: { seatNumber: '12A' },
          },
        ],
      ),
    ).toEqual([{ travelerId: 'trav-1', segmentId: 'seg-1', seatNumber: '12A' }]);
  });
});

describe('isSeatSelectionComplete', () => {
  it('returns true for complete persisted seat assignments', () => {
    expect(
      isSeatSelectionComplete(
        snapshot,
        [{ travelerId: 'trav-1', segmentId: 'seg-out', seatNumber: '1A' }],
        travelers,
      ),
    ).toBe(false);

    expect(
      isSeatSelectionComplete(
        snapshot,
        [
          { travelerId: 'trav-1', segmentId: 'seg-out', seatNumber: '1A' },
          { travelerId: 'trav-2', segmentId: 'seg-out', seatNumber: '1B' },
          { travelerId: 'trav-1', segmentId: 'seg-in', seatNumber: '2A' },
          { travelerId: 'trav-2', segmentId: 'seg-in', seatNumber: '2B' },
        ],
        travelers,
      ),
    ).toBe(true);
  });
});

describe('resolveSeatingTravelers', () => {
  it('excludes held infants from required seat count', () => {
    expect(resolveSeatingTravelers(snapshot, travelers)).toHaveLength(2);
  });
});
