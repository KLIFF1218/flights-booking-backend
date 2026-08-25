import { BadRequestException } from '@nestjs/common';
import { assertTravelersReadyForCheckout } from './booking-traveler-checkout.util';
import type { BookingSnapshot } from '../../interfaces/booking-snapshot.interface';

describe('assertTravelersReadyForCheckout', () => {
  const snapshot = {
    pricing: {
      travelers: [{ travelerType: 'ADULT' }, { travelerType: 'CHILD' }],
    },
  } as BookingSnapshot;

  it('rejects checkout when travelers are missing', () => {
    expect(() => assertTravelersReadyForCheckout(snapshot, [])).toThrow(BadRequestException);
  });

  it('rejects checkout when traveler count does not match pricing', () => {
    expect(() => assertTravelersReadyForCheckout(snapshot, [{ id: 'trav-1' }])).toThrow(
      BadRequestException,
    );
  });

  it('allows checkout when persisted travelers match pricing', () => {
    expect(() =>
      assertTravelersReadyForCheckout(snapshot, [{ id: 'trav-1' }, { id: 'trav-2' }]),
    ).not.toThrow();
  });
});
