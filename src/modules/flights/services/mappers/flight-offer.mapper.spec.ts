import { FlightOfferMapper } from './flight-offer.mapper';
import { preprocessOffers } from '../utils/search/preprocess-offers.util';
import type { FlightOffer } from '../interfaces/flight-offers.interface';

function buildOffer(): FlightOffer {
  return {
    id: 'offer-1',
    numberOfBookableSeats: 9,
    price: {
      total: '250.00',
      currency: 'USD',
      base: '200.00',
      grandTotal: '250.00',
    },
    itineraries: [
      {
        duration: 'PT6H',
        segments: [
          {
            id: 'seg-1',
            flightInstanceId: 'fi-1',
            from: 'JFK',
            to: 'SFO',
            departure: { iataCode: 'JFK', at: '2026-08-15T14:00:00.000Z' },
            arrival: { iataCode: 'SFO', at: '2026-08-15T20:00:00.000Z' },
            carrierCode: 'DL',
            number: '100',
            airline: 'Delta',
            airlineIata: 'DL',
            aircraft: '738',
            operating: { carrierCode: 'DL' },
            duration: 'PT6H',
            blacklistedInEU: false,
          },
        ],
      },
    ],
  } as FlightOffer;
}

describe('FlightOfferMapper', () => {
  const mapper = new FlightOfferMapper();

  it('maps preprocessed offer to flight card response', () => {
    const [preprocessed] = preprocessOffers([buildOffer()]);
    const card = mapper.toCard(preprocessed);

    expect(card.offerId).toBe('offer-1');
    expect(card.routes[0].from).toBe('JFK');
    expect(card.routes[0].to).toBe('SFO');
    expect(card.price.total).toBe(250);
    expect(card.routes[0].availableSeats).toBe(9);
  });
});
