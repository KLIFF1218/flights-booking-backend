import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access-токен для авторизации пользователя',
  })
  accessToken: string;

  @ApiProperty({
    example: 3600000,
    description: 'Время жизни access-токена в миллисекундах',
  })
  accessMaxAge: number;
}
