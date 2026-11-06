import { mapOfferToBookingRoutes } from './booking-offer-routes.util';
import type { FlightOffer } from 'src/modules/flights/interfaces/flight-offers.interface';

function buildOffer(itineraries: FlightOffer['itineraries']): FlightOffer {
  return {
    id: 'offer-1',
    numberOfBookableSeats: 9,
    price: {
      total: '10000',
      currency: 'RUB',
      base: '9000',
      grandTotal: '10000',
    },
    itineraries,
  };
}

describe('mapOfferToBookingRoutes', () => {
  it('maps each itinerary door-to-door, not only the first segment', () => {
    const routes = mapOfferToBookingRoutes(
      buildOffer([
        {
          duration: 'PT5H',
          segments: [
            {
              id: 'seg-1',
              flightInstanceId: 'fi-1',
              from: 'LED',
              to: 'SVO',
              departure: { iataCode: 'LED', at: '2026-08-01T08:00:00.000Z' },
              arrival: { iataCode: 'SVO', at: '2026-08-01T09:30:00.000Z' },
              carrierCode: 'SU',
              number: '100',
              airline: 'Aeroflot',
              airlineIata: 'SU',
              aircraft: null,
              operating: { carrierCode: 'SU' },
              duration: 'PT1H30M',
              blacklistedInEU: false,
            },
            {
              id: 'seg-2',
              flightInstanceId: 'fi-2',
              from: 'SVO',
              to: 'AER',
              departure: { iataCode: 'SVO', at: '2026-08-01T11:00:00.000Z' },
              arrival: { iataCode: 'AER', at: '2026-08-01T14:00:00.000Z' },
              carrierCode: 'SU',
              number: '200',
              airline: 'Aeroflot',
              airlineIata: 'SU',
              aircraft: null,
              operating: { carrierCode: 'SU' },
              duration: 'PT3H',
              blacklistedInEU: false,
            },
          ],
        },
      ]),
    );

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      from: 'LED',
      to: 'AER',
      number: 'SU100',
      airline: 'SU',
      stops: 1,
    });
  });

  it('returns outbound and inbound routes for round-trip offers', () => {
    const segment = (id: string, from: string, to: string, at: string, number: string) => ({
      id,
      flightInstanceId: `fi-${id}`,
      from,
      to,
      departure: { iataCode: from, at },
      arrival: { iataCode: to, at: at.replace('T08', 'T12') },
      carrierCode: 'SU',
      number,
      airline: 'Aeroflot',
      airlineIata: 'SU',
      aircraft: null,
      operating: { carrierCode: 'SU' },
      duration: 'PT4H',
      blacklistedInEU: false,
    });

    const routes = mapOfferToBookingRoutes(
      buildOffer([
        {
          duration: 'PT4H',
          segments: [segment('seg-out', 'LED', 'SVO', '2026-08-01T08:00:00.000Z', '100')],
        },
        {
          duration: 'PT4H',
          segments: [segment('seg-in', 'SVO', 'LED', '2026-08-10T08:00:00.000Z', '101')],
        },
      ]),
    );

    expect(routes).toHaveLength(2);
    expect(routes[0]).toMatchObject({ from: 'LED', to: 'SVO', number: 'SU100' });
    expect(routes[1]).toMatchObject({ from: 'SVO', to: 'LED', number: 'SU101' });
  });
});
