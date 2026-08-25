import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ConfirmEmailDto {
  @ApiProperty({
    description: 'One-time email verification token from the link',
    example: 'xY9kLmN2pQ8rStUvWxYz0123456789ab',
    minLength: 16,
  })
  @IsString()
  @MinLength(16)
  token!: string;
}
