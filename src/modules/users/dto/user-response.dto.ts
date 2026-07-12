import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({ example: 'clt882y0b0001k5qg73in9s8p' })
  id!: string;

  @ApiProperty({ example: 'john@example.com' })
  email!: string;

  @ApiProperty({ example: 'John Doe' })
  fullName!: string;

  @ApiProperty({ example: 'USER', enum: Object.values(Role) })
  role!: Role;

  @ApiProperty({ example: '2025-01-01T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2025-01-01T10:00:00.000Z' })
  updatedAt!: Date;
}
