import { IsOptional, IsString, IsEmail } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Ivan', required: false })
  firstName?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Ivanov', required: false })
  lastName?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '+79261234567', required: false })
  phone?: string;

  @IsOptional()
  @IsEmail()
  @ApiPropertyOptional({ example: 'ivan@example.com', required: false })
  email?: string;
}
