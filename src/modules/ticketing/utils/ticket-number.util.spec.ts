import { formatTicketNumber, generateTicketNumber } from './ticket-number.util';

describe('ticket-number.util', () => {
  it('formats ticket numbers as a 13-digit airline document number', () => {
    expect(formatTicketNumber('5551234567890')).toBe('555-1234567890');
  });

  it('generates a 13-digit ticket number with airline prefix 555', () => {
    const ticketNumber = generateTicketNumber();
    const digits = ticketNumber.replace(/\D/g, '');

    expect(digits).toHaveLength(13);
    expect(digits.startsWith('555')).toBe(true);
    expect(ticketNumber).toMatch(/^555-\d{10}$/);
  });
});
