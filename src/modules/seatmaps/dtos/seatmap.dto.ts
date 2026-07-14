import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { SeatStatus, SeatType, TravelClass } from '@prisma/client';

export class SeatMapDto {
  @ApiProperty({
    description: 'Идентификатор поиска',
    example: '19dcf9c7-c816-47f8-aaa5-b0f7b97fefc4',
  })
  @IsString()
  @IsNotEmpty()
  searchId!: string;

  @ApiProperty({
    description: 'Идентификатор предложения',
    example: '1',
  })
  @IsString()
  @IsNotEmpty()
  offerId!: string;
}

export enum SeatFeature {
  EXIT_ROW = 'EXIT_ROW',
  EXTRA_LEGROOM = 'EXTRA_LEGROOM',
  PREMIUM = 'PREMIUM',
}

export type GridCell =
  | {
      type: 'EMPTY';
    }
  | {
      type: 'FACILITY';
      code: string;
    }
  | {
      type: 'SEAT';
      seatNumber: string;
      isAvailable: boolean;
      minPrice: number | null;

      seatType: SeatType;
      deck: number;
      status: SeatStatus;
      travelClass: TravelClass;

      features: SeatFeature[];
    };

export interface SingleSegmentSeatMapResponse {
  segmentId: string;
  aircraft: string;
  cabin: TravelClass;
  availableSeatsCount: number;
  grid: GridCell[][];
}

export interface SeatMapResponseDto {
  unavailable: boolean;
  seatMaps: SingleSegmentSeatMapResponse[];
}
