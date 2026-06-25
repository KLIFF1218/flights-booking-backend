import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatus } from '@prisma/client';

export class AdminBookingsQueryDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Иван', description: 'Поисковая строка по имени, email или PNR' })
  search?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  @ApiPropertyOptional({
    example: 'CONFIRMED',
    enum: BookingStatus,
    description: 'Статус бронирования для фильтрации',
  })
  status?: BookingStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 1, description: 'Номер страницы для пагинации' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 20, description: 'Количество записей на одной странице' })
  limit: number = 20;
}
