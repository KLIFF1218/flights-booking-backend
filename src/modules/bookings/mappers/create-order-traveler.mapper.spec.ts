import { Gender } from '../dtos/shared/traveler.input.dto';
import { mapCreateOrderTravelerToInput } from './create-order-traveler.mapper';

describe('mapCreateOrderTravelerToInput', () => {
  it('maps traveler contact, passport, and gender', () => {
    const mapped = mapCreateOrderTravelerToInput({
      id: 'trav-1',
      gender: 'FEMALE',
      dateOfBirth: '1990-05-01',
      name: { firstName: 'Jane', lastName: 'Doe' },
      contact: {
        emailAddress: 'jane@example.com',
        phones: [{ countryCallingCode: '+1', number: '5551234' }],
      },
      documents: [
        {
          number: 'P123',
          issuanceDate: '2020-01-01',
          expiryDate: '2030-01-01',
          birthPlace: 'NYC',
          nationality: 'US',
        },
      ],
    });

    expect(mapped).toEqual({
      id: 'trav-1',
      firstName: 'Jane',
      lastName: 'Doe',
      gender: Gender.FEMALE,
      dateOfBirth: '1990-05-01',
      email: 'jane@example.com',
      phoneCountryCode: '1',
      phoneNumber: '5551234',
      passportNumber: 'P123',
      passportIssuanceDate: '2020-01-01',
      passportExpiry: '2030-01-01',
      birthPlace: 'NYC',
      nationality: 'US',
    });
  });
});
