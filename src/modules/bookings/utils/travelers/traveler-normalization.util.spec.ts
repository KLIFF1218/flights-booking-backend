import { PassengerType } from '@prisma/client';
import { normalizeTravelerInput } from './traveler-normalization.util';

describe('normalizeTravelerInput', () => {
  const departureDate = new Date('2026-08-01T10:00:00Z');

  it('trims adult traveler fields', () => {
    const result = normalizeTravelerInput(
      {
        id: 'adult-1',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        email: ' john@example.com ',
        phoneCountryCode: ' 1 ',
        phoneNumber: ' 555 ',
        passportNumber: ' P1 ',
        passportIssuanceDate: '2020-01-01',
        passportExpiry: '2030-01-01',
        nationality: ' US ',
      },
      PassengerType.ADULT,
      true,
      departureDate,
    );

    expect(result.email).toBe('john@example.com');
    expect(result.nationality).toBe('US');
    expect(result.passportNumber).toBe('P1');
  });

  it('fills infant passport defaults for domestic flights', () => {
    const result = normalizeTravelerInput(
      {
        id: 'infant-1',
        firstName: 'Baby',
        lastName: 'Doe',
        dateOfBirth: '2025-01-01',
      },
      PassengerType.HELD_INFANT,
      false,
      departureDate,
    );

    expect(result.passportNumber).toMatch(/^INF-/);
    expect(result.nationality).toBe('RU');
    expect(result.passportExpiry).toBe('2031-08-01');
  });
});
