import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** At least 8 chars, max 128, with a letter and a digit. */
export const PASSWORD_POLICY_MESSAGE =
  'Password must be 8–128 characters and include at least one letter and one number';

export function IsStrongPassword() {
  return applyDecorators(
    IsString(),
    MinLength(8, { message: PASSWORD_POLICY_MESSAGE }),
    MaxLength(128, { message: PASSWORD_POLICY_MESSAGE }),
    Matches(/^(?=.*[A-Za-z])(?=.*\d)[\S]{8,128}$/, {
      message: PASSWORD_POLICY_MESSAGE,
    }),
  );
}
