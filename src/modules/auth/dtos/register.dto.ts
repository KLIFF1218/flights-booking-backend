import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsStrongPassword, PASSWORD_POLICY_MESSAGE } from './password-policy';

export class RegisterDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Unique user email address',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @ApiProperty({
    example: 'StrongPass123!',
    description: PASSWORD_POLICY_MESSAGE,
  })
  @IsNotEmpty({ message: 'Password is required' })
  @IsStrongPassword()
  password!: string;

  @ApiProperty({
    example: 'John',
    description: 'User first name',
  })
  @IsString()
  firstName!: string;

  @ApiProperty({
    example: 'Doe',
    description: 'User last name',
  })
  @IsString()
  lastName!: string;

  @ApiPropertyOptional({ example: 'en', description: 'UI locale at registration' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ example: 'USD', description: 'Preferred search currency' })
  @IsOptional()
  @IsString()
  currency?: string;
}
