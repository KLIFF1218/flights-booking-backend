import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AdminUsersQueryDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'ivan',
    description: 'Поиск по имени, email или id пользователя',
  })
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 1, description: 'Номер страницы' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 20, description: 'Количество элементов на страницу' })
  limit?: number = 20;
}
