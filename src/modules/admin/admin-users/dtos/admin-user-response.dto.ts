import { ApiProperty } from '@nestjs/swagger';
import { Currency, Role, UserStatus } from '@prisma/client';

export class AdminUserSummaryDto {
  @ApiProperty({ example: 'clu3y9ab0002qz0q2yex8w9s0' })
  id!: string;

  @ApiProperty({ example: 'Ivan Ivanov' })
  name!: string;

  @ApiProperty({ example: 'ivan@example.com' })
  email!: string;

  @ApiProperty({ example: '2025-01-15T10:00:00.000Z' })
  registrationDate!: Date;

  @ApiProperty({ example: 3 })
  totalBookings!: number;

  @ApiProperty({ example: 45000 })
  totalSpent!: number;

  @ApiProperty({ example: 'active' })
  status!: string;
}

export class AdminUsersListMetaDto {
  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

export class AdminUsersListResponseDto {
  @ApiProperty({ type: [AdminUserSummaryDto] })
  data!: AdminUserSummaryDto[];

  @ApiProperty({ type: AdminUsersListMetaDto })
  meta!: AdminUsersListMetaDto;
}

/** Block/unblock response — full Prisma User model (without password). */
export class AdminUserStatusResponseDto {
  @ApiProperty({ example: 'clu3y9ab0002qz0q2yex8w9s0' })
  id!: string;

  @ApiProperty({ example: 'ivan@example.com', nullable: true })
  email!: string | null;

  @ApiProperty({ enum: UserStatus, example: UserStatus.BLOCKED })
  status!: UserStatus;

  @ApiProperty({ enum: Role, example: Role.USER })
  role!: Role;

  @ApiProperty({ example: 'Ivan', nullable: true })
  firstName!: string | null;

  @ApiProperty({ example: 'Ivanov', nullable: true })
  lastName!: string | null;

  @ApiProperty({ enum: Currency, example: Currency.RUB })
  currency!: Currency;

  @ApiProperty({ example: '2025-01-15T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2025-01-15T10:00:00.000Z' })
  updatedAt!: Date;
}
