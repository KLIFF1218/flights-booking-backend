import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UserBookingsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 1, description: 'Page number', default: 1 })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @ApiPropertyOptional({
    example: 20,
    description: 'Number of bookings per page',
    default: 20,
    maximum: 50,
  })
  limit?: number = 20;
}
