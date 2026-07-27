import { Injectable } from '@nestjs/common';
import { PassengerType, Prisma } from '@prisma/client';
import { CreateSavedPassengerDto } from '../dtos/create-saved-passenger.dto';
import { SavedPassengerResponseDto } from '../dtos/saved-passenger-response.dto';

export type NormalizedSavedPassenger = CreateSavedPassengerDto & {
  nationality: string;
  passportNumber: string;
  passportIssuanceDate: string;
  passportExpiry: string;
};

const DEFAULT_PASSPORT_VALIDITY_YEARS = 5;

/**
 * Owns the pure domain rules for saved passenger profiles: what counts as a
 * persistable profile, how raw DTOs are normalized/defaulted, and how
 * persistence records map to API DTOs. Holds no dependencies and performs no
 * I/O, so it stays independent of persistence and transport concerns.
 */
@Injectable()
export class SavedPassengerMapper {
  canPersist(dto: CreateSavedPassengerDto): boolean {
    if (dto.passengerType === PassengerType.HELD_INFANT) {
      return Boolean(dto.passportNumber?.trim() && dto.passportExpiry?.trim());
    }

    return Boolean(
      dto.passportNumber?.trim() && dto.passportIssuanceDate?.trim() && dto.passportExpiry?.trim(),
    );
  }

  normalize(dto: CreateSavedPassengerDto): NormalizedSavedPassenger {
    const passportIssuanceDate = dto.passportIssuanceDate?.trim() || dto.dateOfBirth;
    const passportExpiry = dto.passportExpiry?.trim() || this.defaultPassportExpiry();

    return {
      ...dto,
      nationality: dto.nationality?.trim() || 'RU',
      passportNumber: dto.passportNumber!.trim(),
      passportIssuanceDate,
      passportExpiry,
    };
  }

  assertUniquePassportNumbers(travelers: CreateSavedPassengerDto[]): void {
    const seen = new Set<string>();

    for (const traveler of travelers) {
      const passport = traveler.passportNumber?.trim();
      if (!passport) continue;

      if (seen.has(passport)) {
        throw new Error(`Passport number ${passport} is used for multiple passengers`);
      }

      seen.add(passport);
    }
  }

  isDifferentPassenger(
    existing: Prisma.SavedPassengerProfileGetPayload<object>,
    incoming: CreateSavedPassengerDto,
  ): boolean {
    if (existing.passengerType !== incoming.passengerType) {
      return true;
    }

    const sameName =
      existing.firstName.trim().toUpperCase() === incoming.firstName.trim().toUpperCase() &&
      existing.lastName.trim().toUpperCase() === incoming.lastName.trim().toUpperCase();

    return !sameName;
  }

  toCreateData(userId: string, dto: NormalizedSavedPassenger) {
    return {
      userId,
      label: dto.label ?? null,
      isPrimary: dto.isPrimary ?? false,
      passengerType: dto.passengerType,
      firstName: dto.firstName,
      lastName: dto.lastName,
      gender: dto.gender,
      birthDate: new Date(dto.dateOfBirth),
      nationality: dto.nationality,
      birthPlace: dto.birthPlace ?? null,
      passportNumber: dto.passportNumber,
      passportIssuanceDate: new Date(dto.passportIssuanceDate),
      passportExpiry: new Date(dto.passportExpiry),
      email: dto.email ?? null,
      phoneCountryCode: dto.phoneCountryCode ?? null,
      phoneNumber: dto.phoneNumber ?? null,
    };
  }

  toResponse(profile: Prisma.SavedPassengerProfileGetPayload<object>): SavedPassengerResponseDto {
    return {
      id: profile.id,
      label: profile.label,
      isPrimary: profile.isPrimary,
      passengerType: profile.passengerType,
      firstName: profile.firstName,
      lastName: profile.lastName,
      gender: profile.gender,
      dateOfBirth: profile.birthDate.toISOString().slice(0, 10),
      nationality: profile.nationality,
      birthPlace: profile.birthPlace,
      passportNumber: profile.passportNumber,
      passportIssuanceDate: profile.passportIssuanceDate.toISOString().slice(0, 10),
      passportExpiry: profile.passportExpiry.toISOString().slice(0, 10),
      email: profile.email,
      phoneCountryCode: profile.phoneCountryCode,
      phoneNumber: profile.phoneNumber,
    };
  }

  private defaultPassportExpiry(): string {
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + DEFAULT_PASSPORT_VALIDITY_YEARS);
    return expiry.toISOString().slice(0, 10);
  }
}

export function mapTravelerTypeToPassengerType(type: 'adult' | 'child' | 'infant'): PassengerType {
  switch (type) {
    case 'child':
      return PassengerType.CHILD;
    case 'infant':
      return PassengerType.HELD_INFANT;
    default:
      return PassengerType.ADULT;
  }
}
