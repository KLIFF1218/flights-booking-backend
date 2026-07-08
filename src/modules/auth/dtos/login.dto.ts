import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email, указанный при регистрации пользователя',
  })
  @IsNotEmpty({ message: 'Поле email обязательно' })
  @IsEmail({}, { message: 'Некорректный формат email' })
  email!: string;

  @ApiProperty({
    example: 'StrongPass123!',
    description: 'Пароль, указанный при регистрации (от 8 до 128 символов)',
  })
  @IsNotEmpty({ message: 'Поле password обязательно' })
  @IsString()
  @MinLength(8, { message: 'Пароль должен содержать не меньше 8 символов' })
  @MaxLength(128, { message: 'Пароль должен содержать не больше 128 символов' })
  password!: string;
}
