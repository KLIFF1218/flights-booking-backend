import { type TravelerInputDto as CreateOrderTravelerDto } from '../dtos/create-flight-order.input.dto';
import { Gender, type TravelerInputDto } from '../dtos/traveler.input.dto';

function normalizePhoneCountryCode(countryCallingCode: string): string {
  return countryCallingCode.replace(/^\+/, '').trim();
}

export function mapCreateOrderTravelerToInput(traveler: CreateOrderTravelerDto): TravelerInputDto {
  const passport = traveler.documents?.[0];
  const phone = traveler.contact?.phones?.[0];

  return {
    id: traveler.id,
    firstName: traveler.name.firstName,
    lastName: traveler.name.lastName,
    gender: traveler.gender === 'FEMALE' ? Gender.FEMALE : Gender.MALE,
    dateOfBirth: traveler.dateOfBirth,
    email: traveler.contact?.emailAddress,
    phoneCountryCode: phone ? normalizePhoneCountryCode(phone.countryCallingCode) : undefined,
    phoneNumber: phone?.number,
    passportNumber: passport?.number,
    passportIssuanceDate: passport?.issuanceDate,
    passportExpiry: passport?.expiryDate,
    birthPlace: passport?.birthPlace,
    nationality: passport?.nationality,
  };
}
