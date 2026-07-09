import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: '2026-06-17T12:00:00.000Z', description: 'Дата и время ошибки' })
  timestamp!: string;

  @ApiProperty({ example: '/api/users', description: 'Путь запроса, вызвавшего ошибку' })
  path!: string;

  @ApiProperty({ example: 'GET', description: 'HTTP метод запроса' })
  method!: string;

  @ApiProperty({ example: 404, description: 'HTTP статус-код ошибки' })
  statusCode!: number;

  @ApiProperty({ example: 'Not Found', description: 'Краткое описание ошибки' })
  error!: string | object;

  @ApiPropertyOptional({
    example: 'Пользователь не найден',
    description: 'Подробное сообщение ошибки',
  })
  message?: string | string[] | object;

  @ApiPropertyOptional({ example: 'req_12345', description: 'ID запроса для трассировки' })
  requestId?: string;

  @ApiPropertyOptional({ example: 'trace-abc-123', description: 'Trace ID для цепочки запросов' })
  traceId?: string;
}
