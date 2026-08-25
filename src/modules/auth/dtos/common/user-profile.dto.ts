import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({ example: 'user-uuid' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string | null;

  @ApiProperty({ example: 'John', required: false })
  firstName!: string | null;

  @ApiProperty({ example: 'Doe', required: false })
  lastName!: string | null;

  @ApiProperty({ example: 'vk-123456', required: false })
  vkId!: string | null;
}
