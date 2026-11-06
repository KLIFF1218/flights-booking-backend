import { ApiProperty } from '@nestjs/swagger';

export class CsrfResponseDto {
  @ApiProperty({
    description: 'CSRF token to send as x-xsrf-token on cookie-authenticated mutating requests',
  })
  csrfToken!: string;
}
