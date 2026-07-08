import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Уникальный адрес электронной почты пользователя',
  })
  @IsNotEmpty({ message: 'Поле email обязательно' })
  @IsEmail({}, { message: 'Некорректный формат email' })
  email!: string;

  @ApiProperty({
    example: 'StrongPass123!',
    description:
      'Пароль пользователя (от 8 до 128 символов, рекомендуется использовать спецсимволы)',
  })
  @IsNotEmpty({ message: 'Поле password обязательно' })
  @IsString()
  @MinLength(8, { message: 'Пароль должен содержать не меньше 8 символов' })
  @MaxLength(128, { message: 'Пароль должен содержать не больше 128 символов' })
  password!: string;

  @ApiProperty({
    example: 'John',
    description: 'Имя пользователя',
  })
  @IsString()
  firstName!: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Фамилия пользователя',
  })
  @IsString()
  lastName!: string;
}
