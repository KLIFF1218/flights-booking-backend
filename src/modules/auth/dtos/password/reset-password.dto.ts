import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { IsStrongPassword, PASSWORD_POLICY_MESSAGE } from './password-policy';

export class ResetPasswordDto {
  @ApiProperty({ description: 'One-time password reset token from the email link' })
  @IsString()
  @MinLength(16)
  token!: string;

  @ApiProperty({ example: 'NewStrongPass123!', description: PASSWORD_POLICY_MESSAGE })
  @IsStrongPassword()
  newPassword!: string;
}
