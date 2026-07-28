import { PassengerType } from '@prisma/client';
import { mapTravelerTypeToPassengerType, SavedPassengerMapper } from './saved-passenger.mapper';
import type { CreateSavedPassengerDto } from '../dtos/create-saved-passenger.dto';

function buildDto(overrides: Partial<CreateSavedPassengerDto> = {}): CreateSavedPassengerDto {
  return {
    passengerType: PassengerType.ADULT,
    firstName: 'Ivan',
    lastName: 'Ivanov',
    gender: 'MALE',
    dateOfBirth: '1990-01-01',
    passportNumber: '1234567890',
    passportIssuanceDate: '2015-01-01',
    passportExpiry: '2030-01-01',
    ...overrides,
  } as CreateSavedPassengerDto;
}

describe('SavedPassengerMapper', () => {
  const mapper = new SavedPassengerMapper();

  describe('canPersist', () => {
    it('requires full passport fields for adults', () => {
      expect(mapper.canPersist(buildDto())).toBe(true);
      expect(
        mapper.canPersist(buildDto({ passportIssuanceDate: undefined } as CreateSavedPassengerDto)),
      ).toBe(false);
    });

    it('allows held infants with passport number and expiry only', () => {
      expect(
        mapper.canPersist(
          buildDto({
            passengerType: PassengerType.HELD_INFANT,
            passportIssuanceDate: undefined,
          } as CreateSavedPassengerDto),
        ),
      ).toBe(true);
    });
  });

  describe('normalize', () => {
    it('defaults nationality and passport dates', () => {
      const normalized = mapper.normalize(
        buildDto({
          nationality: undefined,
          passportIssuanceDate: undefined,
        } as CreateSavedPassengerDto),
      );

      expect(normalized.nationality).toBe('RU');
      expect(normalized.passportIssuanceDate).toBe('1990-01-01');
      expect(normalized.passportExpiry).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('assertUniquePassportNumbers', () => {
    it('rejects duplicate passport numbers in one batch', () => {
      expect(() =>
        mapper.assertUniquePassportNumbers([
          buildDto({ passportNumber: '1111111111' }),
          buildDto({ passportNumber: '1111111111', firstName: 'Petr' }),
        ]),
      ).toThrow(/Passport number 1111111111 is used for multiple passengers/);
    });
  });

  describe('isDifferentPassenger', () => {
    it('detects passenger type or name mismatch for the same passport', () => {
      const existing = {
        passengerType: PassengerType.ADULT,
        firstName: 'IVAN',
        lastName: 'IVANOV',
      } as never;

      expect(mapper.isDifferentPassenger(existing, buildDto())).toBe(false);
      expect(
        mapper.isDifferentPassenger(existing, buildDto({ passengerType: PassengerType.CHILD })),
      ).toBe(true);
      expect(
        mapper.isDifferentPassenger(existing, buildDto({ firstName: 'Petr', lastName: 'Petrov' })),
      ).toBe(true);
    });
  });

  describe('mapTravelerTypeToPassengerType', () => {
    it('maps booking traveler types to passenger enums', () => {
      expect(mapTravelerTypeToPassengerType('adult')).toBe(PassengerType.ADULT);
      expect(mapTravelerTypeToPassengerType('child')).toBe(PassengerType.CHILD);
      expect(mapTravelerTypeToPassengerType('infant')).toBe(PassengerType.HELD_INFANT);
    });
  });
});
