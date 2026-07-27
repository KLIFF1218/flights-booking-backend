import { ApiProperty } from '@nestjs/swagger';

export class MarkAllNotificationsReadResponseDto {
  @ApiProperty({ example: 3 })
  updated!: number;
}
