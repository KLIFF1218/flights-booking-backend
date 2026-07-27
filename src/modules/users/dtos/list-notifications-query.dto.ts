import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListNotificationsQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @ApiPropertyOptional({ example: false })
  unreadOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  limit?: number;
}
