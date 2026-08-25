import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token for user authorization',
  })
  accessToken!: string;

  @ApiProperty({
    example: 3600000,
    description: 'Access token lifetime in milliseconds',
  })
  accessMaxAge!: number;

  @ApiProperty({
    description:
      'CSRF token for subsequent cookie-authenticated requests (refresh/logout). Also set as XSRF-TOKEN cookie.',
  })
  csrfToken!: string;
}
