import type { SeatType as PrismaSeatType } from '@prisma/client';
import { deriveSeatAttributesFromRow } from '../../../src/shared/pricing/seat-fee.catalog';

export type SeatType = 'WINDOW' | 'AISLE' | 'MIDDLE';

export interface SeatTemplateData {
  number: string;
  x: number;
  y: number;
  deck: number;
  seatType: SeatType;
  isExitRow: boolean;
  isExtraLegroom: boolean;
  isPremium: boolean;
}

export interface CabinScheme {
  rows: number;
  blocks: string[][];
}

/** Number of seats in a row (excluding aisles) */
const SCHEMES: Record<number, CabinScheme> = {
  5: {
    rows: 28,
    blocks: [
      ['A', 'B'],
      ['C', 'D', 'E'],
    ],
  },
  6: {
    rows: 30,
    blocks: [
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
    ],
  },
  8: {
    rows: 38,
    blocks: [
      ['A', 'B'],
      ['C', 'D', 'E', 'F'],
      ['G', 'H'],
    ],
  },
  9: {
    rows: 35,
    blocks: [
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
      ['G', 'H', 'J'],
    ],
  },
  10: {
    rows: 40,
    blocks: [
      ['A', 'B', 'C'],
      ['D', 'E', 'F', 'G'],
      ['H', 'J', 'K'],
    ],
  },
};

function resolveSeatType(block: string[], index: number): SeatType {
  const isWindow = index === 0 || index === block.length - 1;

  const isAisle =
    (block.length === 2 && index === 1) ||
    (block.length === 3 && (index === 0 || index === 2)) ||
    (block.length === 4 && (index === 0 || index === 3));

  if (isWindow) return 'WINDOW';
  if (isAisle) return 'AISLE';
  return 'MIDDLE';
}

/** Grid width including aisles between blocks */
export function getGridWidth(seatsPerRow: number): number {
  const scheme = SCHEMES[seatsPerRow];
  if (!scheme) {
    throw new Error(`Unsupported seat row width ${seatsPerRow}`);
  }

  const seatCount = scheme.blocks.reduce((sum, block) => sum + block.length, 0);
  const aisleCount = scheme.blocks.length - 1;

  return seatCount + aisleCount;
}

export function generateSeats(seatsPerRow: number, rows?: number): SeatTemplateData[] {
  const scheme = SCHEMES[seatsPerRow];

  if (!scheme) {
    throw new Error(`Unsupported seat row width ${seatsPerRow}`);
  }

  const totalRows = rows ?? scheme.rows;
  const seats: SeatTemplateData[] = [];

  for (let row = 1; row <= totalRows; row++) {
    let x = 0;
    const rowAttributes = deriveSeatAttributesFromRow(row);

    scheme.blocks.forEach((block, blockIndex) => {
      for (let i = 0; i < block.length; i++) {
        const letter = block[i];

        seats.push({
          number: `${row}${letter}`,
          x,
          y: row - 1,
          deck: 0,
          seatType: resolveSeatType(block, i),
          ...rowAttributes,
        });

        x++;
      }

      if (blockIndex < scheme.blocks.length - 1) {
        x++;
      }
    });
  }

  return seats;
}

export function findSeatsPerRowForGridWidth(gridWidth: number): number | null {
  for (const seatsPerRow of Object.keys(SCHEMES).map(Number)) {
    if (getGridWidth(seatsPerRow) === gridWidth) {
      return seatsPerRow;
    }
  }

  if (SCHEMES[gridWidth]) {
    return gridWidth;
  }

  return null;
}
