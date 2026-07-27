import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiProperty,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { CSRF_HEADER_NAME } from '../constants/csrf.constants';
import { SWAGGER_BEARER_AUTH } from 'src/config/swagger-auth';

export const ApiBearerAuthRequired = () => ApiBearerAuth(SWAGGER_BEARER_AUTH);

/** Double-submit CSRF header required on cookie-authenticated mutating auth routes. */
export const ApiCsrfHeader = () =>
  ApiHeader({
    name: CSRF_HEADER_NAME,
    required: true,
    description:
      'Must match the non-HttpOnly XSRF-TOKEN cookie. Obtain via GET /auth/csrf or from login/register/refresh (csrfToken + Set-Cookie).',
  });

export const ApiUserAuthErrors = () =>
  applyDecorators(
    ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto }),
    ApiForbiddenResponse({
      description: 'USER or ADMIN role required',
      type: ErrorResponseDto,
    }),
  );

export const ApiAdminAuthErrors = () =>
  applyDecorators(
    ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponseDto }),
    ApiForbiddenResponse({ description: 'ADMIN role required', type: ErrorResponseDto }),
  );

export const ApiBadRequestError = () =>
  ApiBadRequestResponse({ description: 'Validation error', type: ErrorResponseDto });

export const ApiNotFoundError = (description = 'Resource not found') =>
  ApiNotFoundResponse({ description, type: ErrorResponseDto });

export const ApiConflictError = (description: string) =>
  ApiConflictResponse({ description, type: ErrorResponseDto });

export class SuccessResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;
}
