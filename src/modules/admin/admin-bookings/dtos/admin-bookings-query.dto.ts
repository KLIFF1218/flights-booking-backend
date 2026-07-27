import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatus } from '@prisma/client';

export class AdminBookingsQueryDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'John', description: 'Search string by name, email, or PNR' })
  search?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  @ApiPropertyOptional({
    example: 'CONFIRMED',
    enum: BookingStatus,
    description: 'Booking status for filtering',
  })
  status?: BookingStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 1, description: 'Page number for pagination' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 20, description: 'Number of records per page' })
  limit: number = 20;
}
