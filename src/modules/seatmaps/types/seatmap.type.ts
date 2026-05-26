export interface AmadeusSeatMapResponse {
  meta: Meta;
  data: SeatMap[];
  dictionaries: SeatMapDictionaries;
}

export interface Meta {
  count: number;
  links: {
    self: string;
  };
}

export interface SeatMap {
  id: string;
  type: 'seatmap';

  departure: AirportPoint;
  arrival: AirportPoint;

  carrierCode: string;
  number: string;

  operating: Operating;
  aircraft: Aircraft;

  class: string;
  flightOfferId: string;
  segmentId: string;

  decks: Deck[];

  aircraftCabinAmenities?: AircraftCabinAmenities;
  availableSeatsCounters?: AvailableSeatsCounter[];
}

export interface AirportPoint {
  iataCode: string;
  terminal?: string;
  at: string;
}

export interface Operating {
  carrierCode: string;
}

export interface Aircraft {
  code: string;
}

export interface Deck {
  deckType: string;
  deckConfiguration: DeckConfiguration;
  facilities?: Facility[];
  seats?: Seat[];
}

export interface DeckConfiguration {
  width: number;
  length: number;
  startSeatRow: number;
  endSeatRow: number;
}

export interface Facility {
  code: string;
  column?: string;
  position?: string;
  coordinates: Coordinates;
}

export interface Seat {
  cabin: string;
  number: string;
  characteristicsCodes?: string[];
  travelerPricing?: SeatTravelerPricing[];
  coordinates: Coordinates;
}

export interface Coordinates {
  x: number;
  y: number;
}

export interface SeatTravelerPricing {
  travelerId: string;
  seatAvailabilityStatus: string;
  price?: SeatPrice;
}

export interface SeatPrice {
  currency: string;
  total: string;
  base: string;
  taxes?: Tax[];
}

export interface Tax {
  amount: string;
  code: string;
}

export interface AircraftCabinAmenities {
  power?: PowerAmenity;
  seat?: SeatAmenity;
  food?: FoodAmenity;
  beverage?: BeverageAmenity;
}

export interface PowerAmenity {
  isChargeable: boolean;
  powerType: string;
  usbType?: string;
}

export interface SeatAmenity {
  legSpace: number;
  spaceUnit: string;
  tilt: string;
}

export interface FoodAmenity {
  isChargeable: boolean;
  foodType: string;
}

export interface BeverageAmenity {
  isChargeable: boolean;
  beverageType: string;
}

export interface AvailableSeatsCounter {
  travelerId: string;
  value: number;
}

export interface SeatMapDictionaries {
  locations: Record<string, LocationDictionaryItem>;
  facilities: Record<string, string>;
  seatCharacteristics: Record<string, string>;
}

export interface LocationDictionaryItem {
  cityCode: string;
  countryCode: string;
}
