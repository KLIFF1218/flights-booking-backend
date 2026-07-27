const TICKETING_AIRLINE_NUMERIC_CODE = '555';

export function generateTicketNumber(): string {
  const serial = Math.floor(Math.random() * 1_000_000_000);
  const checkDigit = serial % 7;
  const digits = `${TICKETING_AIRLINE_NUMERIC_CODE}${String(serial).padStart(9, '0')}${checkDigit}`;

  return formatTicketNumber(digits);
}

export function formatTicketNumber(digits: string): string {
  const normalized = digits.replace(/\D/g, '');

  if (normalized.length !== 13) {
    return digits;
  }

  return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
}
