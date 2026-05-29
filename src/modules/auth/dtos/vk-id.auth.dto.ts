import { IsString } from 'class-validator';

export class VkIdAuthDto {
  @IsString()
  code: string;

  @IsString()
  state: string;

  @IsString()
  code_verifier: string;

  @IsString()
  device_id: string;
}
