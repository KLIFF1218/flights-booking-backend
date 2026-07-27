import { ApiProperty } from '@nestjs/swagger';

export class BookingTicketItemDto {
  @ApiProperty({ example: 'traveler-1' })
  travelerId!: string;

  @ApiProperty({ example: '555-1234567890' })
  ticketNumber!: string;

  @ApiProperty({ example: 'ISSUED' })
  status!: string;

  @ApiProperty({ description: 'URL for inline PDF preview' })
  previewUrl!: string;

  @ApiProperty({ description: 'URL for PDF download' })
  downloadUrl!: string;

  @ApiProperty({ description: 'URL depending on mode (view | download)' })
  url!: string;
}
