import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword, PASSWORD_POLICY_MESSAGE } from './password-policy';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ example: 'NewStrongPass123!', description: PASSWORD_POLICY_MESSAGE })
  @IsStrongPassword()
  newPassword!: string;
}
