import { Currency } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'RU', required: false })
  country?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'RU', required: false })
  citizenship?: string;

  @IsOptional()
  @IsEnum(Currency)
  @ApiPropertyOptional({ example: 'RUB', enum: Currency, required: false })
  currency?: Currency;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Moscow', required: false })
  city?: string;
}
