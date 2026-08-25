import { ApiProperty } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty({
    description: 'Refresh token / session id',
    example: 'clxyz0123456789abcdef',
  })
  id!: string;

  @ApiProperty({
    description: 'Linked device id',
    example: 'cldev0123456789abcdef',
  })
  deviceId!: string;

  @ApiProperty({
    nullable: true,
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
  })
  userAgent!: string | null;

  @ApiProperty({ nullable: true, example: '203.0.113.10' })
  ip!: string | null;

  @ApiProperty({ example: '2026-07-25T08:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({
    description: 'Device lastSeen (updated on login/refresh)',
    example: '2026-07-25T09:15:00.000Z',
  })
  lastSeen!: Date;

  @ApiProperty({ example: '2026-08-01T08:00:00.000Z' })
  expiresAt!: Date;

  @ApiProperty({
    description: 'True when this session matches the refresh cookie on the request',
    example: true,
  })
  current!: boolean;
}

export class SessionsListResponseDto {
  @ApiProperty({ type: [SessionResponseDto] })
  sessions!: SessionResponseDto[];
}

export class RevokeSessionResponseDto {
  @ApiProperty({ example: true })
  ok!: true;

  @ApiProperty({
    example: false,
    description: 'True when the revoked session was the current refresh cookie session',
  })
  revokedCurrent!: boolean;
}
