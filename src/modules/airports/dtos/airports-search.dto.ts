import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchLocationsDto {
  @ApiProperty({ example: 'SVO', description: 'Search text (minimum 2 characters)', minLength: 2 })
  @IsString()
  @MinLength(2)
  @Length(2, 64)
  q!: string;

  @ApiPropertyOptional({ example: 'Russia', description: 'Filter by country name' })
  @IsOptional()
  @IsString()
  @Length(2, 64)
  country?: string;

  @ApiPropertyOptional({ description: 'Cursor for the next page of results' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of results per page (1-50)',
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
