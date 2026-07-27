import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserNotificationType } from '@prisma/client';

export class UserNotificationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  bookingId?: string | null;

  @ApiProperty({ enum: UserNotificationType })
  type!: UserNotificationType;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({ nullable: true })
  readAt?: Date | null;

  @ApiProperty()
  createdAt!: Date;
}
