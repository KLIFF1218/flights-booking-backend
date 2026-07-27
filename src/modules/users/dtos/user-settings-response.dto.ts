import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '@prisma/client';

export class UserSettingsResponseDto {
  @ApiProperty({ example: 'RU', nullable: true })
  country!: string | null;

  @ApiProperty({ example: 'RU', nullable: true })
  citizenship!: string | null;

  @ApiProperty({ enum: Currency, example: Currency.RUB, nullable: true })
  currency!: Currency | null;

  @ApiProperty({ example: 'Moscow', nullable: true })
  city!: string | null;
}
