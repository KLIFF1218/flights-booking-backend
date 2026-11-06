import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SeatStatus, SeatType, TravelClass } from '@prisma/client';

export class SeatMapDto {
  @ApiProperty({
    description: 'Search identifier',
    example: '19dcf9c7-c816-47f8-aaa5-b0f7b97fefc4',
  })
  @IsString()
  @IsNotEmpty()
  searchId!: string;

  @ApiProperty({
    description: 'Offer identifier',
    example: '1',
  })
  @IsString()
  @IsNotEmpty()
  offerId!: string;

  @ApiPropertyOptional({
    description: 'Active booking id — restores offer from snapshot when search cache expired',
    example: 'clu3y9ab0002qz0q2yex8w9s0',
  })
  @IsOptional()
  @IsString()
  bookingId?: string;
}

export enum SeatFeature {
  EXIT_ROW = 'EXIT_ROW',
  EXTRA_LEGROOM = 'EXTRA_LEGROOM',
  PREMIUM = 'PREMIUM',
}

export class GridCellDto {
  @ApiProperty({ enum: ['EMPTY', 'FACILITY', 'SEAT'] })
  type!: 'EMPTY' | 'FACILITY' | 'SEAT';

  @ApiProperty({ required: false, example: 'LAVATORY' })
  code?: string;

  @ApiProperty({ required: false, example: '12A' })
  seatNumber?: string;

  @ApiProperty({ required: false })
  isAvailable?: boolean;

  @ApiProperty({ required: false, nullable: true })
  minPrice?: number | null;

  @ApiProperty({ required: false, enum: SeatType })
  seatType?: SeatType;

  @ApiProperty({ required: false })
  deck?: number;

  @ApiProperty({ required: false, enum: SeatStatus })
  status?: SeatStatus;

  @ApiProperty({ required: false, enum: TravelClass })
  travelClass?: TravelClass;

  @ApiProperty({ required: false, enum: SeatFeature, isArray: true })
  features?: SeatFeature[];
}

export type GridCell =
  | { type: 'EMPTY' }
  | { type: 'FACILITY'; code: string }
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

export class SingleSegmentSeatMapResponseDto {
  @ApiProperty({ example: 'segment-1' })
  segmentId!: string;

  @ApiProperty({ example: 'Airbus A320' })
  aircraft!: string;

  @ApiProperty({ enum: TravelClass, example: TravelClass.ECONOMY })
  cabin!: TravelClass;

  @ApiProperty({ example: 42 })
  availableSeatsCount!: number;

  @ApiProperty({
    description: 'Two-dimensional cabin grid',
    type: 'array',
    items: { type: 'array', items: { $ref: '#/components/schemas/GridCellDto' } },
  })
  grid!: GridCell[][];
}

export interface SingleSegmentSeatMapResponse {
  segmentId: string;
  aircraft: string;
  cabin: TravelClass;
  availableSeatsCount: number;
  grid: GridCell[][];
}

export class SeatMapResponseDto {
  @ApiProperty({ example: false })
  unavailable!: boolean;

  @ApiProperty({ type: [SingleSegmentSeatMapResponseDto] })
  seatMaps!: SingleSegmentSeatMapResponse[];
}

export interface SeatMapResponseDtoInterface {
  unavailable: boolean;
  seatMaps: SingleSegmentSeatMapResponse[];
}
