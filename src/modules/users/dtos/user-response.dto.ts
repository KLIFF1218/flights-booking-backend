import { ApiProperty } from '@nestjs/swagger';
import { Currency, Role, UserStatus } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({ example: 'clt882y0b0001k5qg73in9s8p' })
  id!: string;

  @ApiProperty({ example: 'john@example.com', nullable: true })
  email!: string | null;

  @ApiProperty({ example: 'John', nullable: true })
  firstName!: string | null;

  @ApiProperty({ example: 'Doe', nullable: true })
  lastName!: string | null;

  @ApiProperty({ example: '+79261234567', nullable: true })
  phone!: string | null;

  @ApiProperty({ example: 'USER', enum: Role })
  role!: Role;

  @ApiProperty({ example: 'ACTIVE', enum: UserStatus })
  status!: UserStatus;

  @ApiProperty({ example: 'RU', nullable: true })
  country!: string | null;

  @ApiProperty({ example: 'RU', nullable: true })
  citizenship!: string | null;

  @ApiProperty({ example: 'Moscow', nullable: true })
  city!: string | null;

  @ApiProperty({ enum: Currency, example: Currency.RUB })
  currency!: Currency;

  @ApiProperty({ example: '2025-01-01T10:00:00.000Z', nullable: true })
  emailVerifiedAt!: Date | null;

  @ApiProperty({ example: '2025-01-01T10:00:00.000Z', nullable: true })
  lastLoginAt!: Date | null;

  @ApiProperty({ example: '2025-01-01T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2025-01-01T10:00:00.000Z' })
  updatedAt!: Date;
}
