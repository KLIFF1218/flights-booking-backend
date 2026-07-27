import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsNumber } from 'class-validator';

export enum FlightStatusUpdate {
  ON_TIME = 'on-time',
  DELAYED = 'delayed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export class UpdateFlightStatusDto {
  @IsEnum(FlightStatusUpdate)
  @ApiProperty({ example: FlightStatusUpdate.ON_TIME, enum: FlightStatusUpdate })
  status!: FlightStatusUpdate;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 15, description: 'Flight delay in minutes' })
  delayMinutes?: number;
}
