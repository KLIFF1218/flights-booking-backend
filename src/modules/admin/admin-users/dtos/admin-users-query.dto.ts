import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const MAX_ADMIN_USERS_PAGE_SIZE = 100;

export class AdminUsersQueryDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'ivan',
    description: 'Search by name, email, or user id',
  })
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 1, description: 'Page number' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ADMIN_USERS_PAGE_SIZE)
  @ApiPropertyOptional({
    example: 20,
    description: 'Number of items per page',
    maximum: MAX_ADMIN_USERS_PAGE_SIZE,
  })
  limit?: number = 20;
}
