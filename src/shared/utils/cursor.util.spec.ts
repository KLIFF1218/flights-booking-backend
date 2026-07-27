import { BadRequestException } from '@nestjs/common';
import { decodeCursor, encodeCursor } from './cursor.util';

describe('cursor.util', () => {
  describe('encodeCursor / decodeCursor', () => {
    it('round-trips a payload', () => {
      const payload = { city: 'Moscow', name: 'SVO', id: 'ap_1' };
      const cursor = encodeCursor(payload);

      expect(decodeCursor<typeof payload>(cursor)).toEqual(payload);
    });

    it('returns null for empty cursor', () => {
      expect(decodeCursor(undefined)).toBeNull();
      expect(decodeCursor('')).toBeNull();
    });

    it('throws BadRequestException for malformed cursor', () => {
      expect(() => decodeCursor('not-valid-base64url!!!')).toThrow(BadRequestException);
    });
  });
});
