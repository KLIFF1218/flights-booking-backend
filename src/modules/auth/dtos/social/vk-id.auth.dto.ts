import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VkIdAuthDto {
  @ApiProperty({
    description: 'Authorization code from VK ID',
    example: 'vk1.a.exampleAuthorizationCode',
  })
  @IsString()
  code!: string;

  @ApiProperty({
    description: 'OAuth state previously registered via POST /auth/vk/prepare',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  state!: string;

  @ApiProperty({
    description: 'PKCE code verifier paired with the authorize challenge',
    example: 'dBjftHlHXG_P0V8xGXkzWqXzq0zq0zq0zq0zq0zq0z',
  })
  @IsString()
  code_verifier!: string;

  @ApiProperty({
    description: 'VK device identifier from the VK ID SDK',
    example: 'device_abc123',
  })
  @IsString()
  device_id!: string;
}
