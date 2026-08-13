import { ApiProperty } from '@nestjs/swagger';
import { AuthResponseDto } from './auth.response.dto';

export class RegisterAuthResponseDto extends AuthResponseDto {
  @ApiProperty({
    description:
      'Whether the verification email was dispatched. False when delivery is misconfigured or the provider rejected the send.',
  })
  verificationEmailSent!: boolean;
}
