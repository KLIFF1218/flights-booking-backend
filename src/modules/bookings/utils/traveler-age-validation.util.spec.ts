import { BadRequestException } from '@nestjs/common';
import { PassengerType } from '@prisma/client';
import { validateTravelersForBooking } from './traveler-age-validation.util';

describe('validateTravelersForBooking', () => {
  const departureDate = new Date('2026-08-01T10:00:00Z');

  it('rejects duplicate traveler ids in the same request', () => {
    expect(() =>
      validateTravelersForBooking(
        [
          {
            id: 'traveler-1',
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            nationality: 'US',
            birthPlace: 'NYC',
            passportNumber: 'AB1234567',
            passportIssuanceDate: '2020-01-01',
            passportExpiry: '2030-01-01',
            gender: 'MALE',
          },
          {
            id: 'traveler-1',
            firstName: 'Jane',
            lastName: 'Doe',
            dateOfBirth: '1992-01-01',
            nationality: 'US',
            birthPlace: 'NYC',
            passportNumber: 'CD1234567',
            passportIssuanceDate: '2020-01-01',
            passportExpiry: '2030-01-01',
            gender: 'FEMALE',
          },
        ],
        [PassengerType.ADULT, PassengerType.ADULT],
        departureDate,
        false,
      ),
    ).toThrow(BadRequestException);
  });
});
