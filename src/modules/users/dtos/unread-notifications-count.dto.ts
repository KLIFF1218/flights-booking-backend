import { ApiProperty } from '@nestjs/swagger';

export class UnreadNotificationsCountDto {
  @ApiProperty({ example: 3 })
  count!: number;
}
