import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: '2026-06-17T12:00:00.000Z', description: 'Error date and time' })
  timestamp!: string;

  @ApiProperty({ example: '/api/users', description: 'Request path that caused the error' })
  path!: string;

  @ApiProperty({ example: 'GET', description: 'HTTP request method' })
  method!: string;

  @ApiProperty({ example: 404, description: 'HTTP error status code' })
  statusCode!: number;

  @ApiProperty({ example: 'Not Found', description: 'Short error description' })
  error!: string | object;

  @ApiPropertyOptional({
    example: 'User not found',
    description: 'Detailed error message',
  })
  message?: string | string[] | Record<string, unknown>;

  @ApiPropertyOptional({ example: 'req_12345', description: 'Request ID for tracing' })
  requestId?: string;

  @ApiPropertyOptional({ example: 'trace-abc-123', description: 'Trace ID for the request chain' })
  traceId?: string;
}
