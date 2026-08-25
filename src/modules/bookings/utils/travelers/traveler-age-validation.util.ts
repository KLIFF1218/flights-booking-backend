import { BadRequestException } from '@nestjs/common';
import { PassengerType } from '@prisma/client';
import { type TravelerInputDto } from '../../dtos/shared/traveler.input.dto';
import { isInfantType } from 'src/shared/booking/passenger-counts.util';
import { extractIsInternationalFromSnapshot } from '../flight/flight-route.util';

function ageOnDate(birthDate: Date, referenceDate: Date): number {
  let years = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
  const dayDiff = referenceDate.getDate() - birthDate.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years -= 1;
  }

  return years;
}

function parseDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid ${field}: ${value}`);
  }
  return date;
}

function validateAgeForPassengerType(age: number, passengerType: PassengerType) {
  if (passengerType === PassengerType.ADULT && age < 12) {
    throw new BadRequestException(
      'Adult passenger must be at least 12 years old on departure date',
    );
  }

  if (passengerType === PassengerType.CHILD && (age < 2 || age > 11)) {
    throw new BadRequestException(
      'Child passenger must be between 2 and 11 years old on departure date',
    );
  }

  if (isInfantType(passengerType) && age >= 2) {
    throw new BadRequestException('Infant passenger must be under 2 years old on departure date');
  }
}

function validateInfantDocuments(traveler: TravelerInputDto, isInternational: boolean) {
  if (!isInternational) {
    return;
  }

  if (!traveler.nationality?.trim()) {
    throw new BadRequestException('Infant nationality is required for international flights');
  }

  const passport = traveler.passportNumber?.trim();
  if (!passport || passport.length < 5) {
    throw new BadRequestException('Infant document number is required for international flights');
  }

  if (!traveler.passportExpiry?.trim()) {
    throw new BadRequestException('Infant document expiry is required for international flights');
  }
}

function validateAdultChildDocuments(traveler: TravelerInputDto) {
  if (!traveler.nationality?.trim()) {
    throw new BadRequestException('Nationality is required');
  }

  if (!traveler.birthPlace?.trim()) {
    throw new BadRequestException('Birth place is required');
  }

  const passport = traveler.passportNumber?.trim();
  if (!passport || passport.length < 5) {
    throw new BadRequestException('Passport number is required');
  }

  if (!traveler.passportIssuanceDate?.trim()) {
    throw new BadRequestException('Passport issuance date is required');
  }

  if (!traveler.passportExpiry?.trim()) {
    throw new BadRequestException('Passport expiry is required');
  }
}

function validateInfantAccompaniment(
  travelers: TravelerInputDto[],
  passengerTypes: PassengerType[],
) {
  const adultIds = new Set<string>();

  travelers.forEach((traveler, index) => {
    if (passengerTypes[index] === PassengerType.ADULT && traveler.id) {
      adultIds.add(traveler.id);
    }
  });

  const accompanimentCount = new Map<string, number>();

  travelers.forEach((traveler, index) => {
    const passengerType = passengerTypes[index];
    if (!isInfantType(passengerType)) {
      return;
    }

    if (!traveler.accompanyingTravelerId) {
      throw new BadRequestException('Infant must be linked to an accompanying adult');
    }

    if (!adultIds.has(traveler.accompanyingTravelerId)) {
      throw new BadRequestException('Accompanying adult not found in booking');
    }

    const nextCount = (accompanimentCount.get(traveler.accompanyingTravelerId) ?? 0) + 1;
    if (nextCount > 1) {
      throw new BadRequestException('Each adult can accompany at most one infant');
    }

    accompanimentCount.set(traveler.accompanyingTravelerId, nextCount);
  });
}

function assertUniqueTravelerIds(travelers: TravelerInputDto[]): void {
  const travelerIds = travelers
    .map((traveler) => traveler.id)
    .filter((id): id is string => Boolean(id));

  if (new Set(travelerIds).size !== travelerIds.length) {
    throw new BadRequestException('Duplicate traveler id in request');
  }
}

export function validateTravelersForBooking(
  travelers: TravelerInputDto[],
  passengerTypes: PassengerType[],
  departureDate: Date,
  isInternational: boolean,
) {
  if (travelerPricingsLengthMismatch(travelers, passengerTypes)) {
    throw new BadRequestException('Traveler count does not match booking passenger mix');
  }

  assertUniqueTravelerIds(travelers);

  const passports = new Set<string>();

  travelers.forEach((traveler, index) => {
    const passengerType = passengerTypes[index] ?? PassengerType.ADULT;
    const birthDate = parseDate(traveler.dateOfBirth, 'dateOfBirth');
    const age = ageOnDate(birthDate, departureDate);

    validateAgeForPassengerType(age, passengerType);

    if (isInfantType(passengerType)) {
      validateInfantDocuments(traveler, isInternational);
    } else {
      validateAdultChildDocuments(traveler);
    }

    const passport = traveler.passportNumber?.trim().toUpperCase();
    if (passport && !passport.startsWith('INF-')) {
      if (passports.has(passport)) {
        throw new BadRequestException('Passport numbers must be unique for each traveler');
      }
      passports.add(passport);
    }
  });

  const adults = passengerTypes.filter((type) => type === PassengerType.ADULT).length;
  const infants = passengerTypes.filter((type) => isInfantType(type)).length;

  if (infants > adults) {
    throw new BadRequestException('Infants cannot exceed adults');
  }

  validateInfantAccompaniment(travelers, passengerTypes);
}

function travelerPricingsLengthMismatch(
  travelers: TravelerInputDto[],
  passengerTypes: PassengerType[],
) {
  return passengerTypes.length > 0 && travelers.length !== passengerTypes.length;
}

export function extractDepartureDateFromSnapshot(snapshot: {
  offer?: {
    itineraries?: Array<{
      segments?: Array<{ departure?: { at?: string } }>;
    }>;
  };
}): Date {
  const departureAt = snapshot.offer?.itineraries?.[0]?.segments?.[0]?.departure?.at;
  if (!departureAt) {
    throw new BadRequestException('Departure date not found in booking snapshot');
  }

  const departureDate = new Date(departureAt);
  if (Number.isNaN(departureDate.getTime())) {
    throw new BadRequestException('Invalid departure date in booking snapshot');
  }

  return departureDate;
}

export { extractIsInternationalFromSnapshot };
