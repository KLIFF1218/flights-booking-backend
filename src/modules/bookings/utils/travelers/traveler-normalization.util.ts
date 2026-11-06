import { type PassengerType } from '@prisma/client';
import { type TravelerInputDto } from '../../dtos/shared/traveler.input.dto';
import { isInfantType } from 'src/shared/booking/passenger-counts.util';

export type PersistableTravelerInput = TravelerInputDto & {
  nationality: string;
  passportNumber: string;
  passportIssuanceDate: string;
  passportExpiry: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
};

function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

export function normalizeTravelerInput(
  traveler: TravelerInputDto,
  passengerType: PassengerType,
  isInternational: boolean,
  departureDate: Date,
): PersistableTravelerInput {
  if (!isInfantType(passengerType)) {
    return {
      ...traveler,
      nationality: traveler.nationality?.trim() ?? '',
      birthPlace: traveler.birthPlace?.trim() || undefined,
      passportNumber: traveler.passportNumber?.trim() ?? '',
      passportIssuanceDate: traveler.passportIssuanceDate ?? '',
      passportExpiry: traveler.passportExpiry ?? '',
      email: traveler.email?.trim() ?? '',
      phoneCountryCode: traveler.phoneCountryCode?.trim() ?? '',
      phoneNumber: traveler.phoneNumber?.trim() ?? '',
    };
  }

  const travelerId = traveler.id?.trim() || 'infant';
  const passportNumber =
    traveler.passportNumber?.trim() ||
    (isInternational ? '' : `INF-${travelerId.replace(/-/g, '').slice(0, 12)}`);

  const birthDate = traveler.dateOfBirth;
  const passportIssuanceDate = traveler.passportIssuanceDate?.trim() || birthDate;
  const passportExpiry =
    traveler.passportExpiry?.trim() || addYears(departureDate, 5).toISOString().slice(0, 10);

  return {
    ...traveler,
    nationality: traveler.nationality?.trim() || 'RU',
    birthPlace: traveler.birthPlace?.trim() || undefined,
    passportNumber,
    passportIssuanceDate,
    passportExpiry,
    email: traveler.email?.trim() || '',
    phoneCountryCode: traveler.phoneCountryCode?.trim() || '',
    phoneNumber: traveler.phoneNumber?.trim() || '',
  };
}
