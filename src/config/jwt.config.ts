import type { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { getJwtAccessSecret } from './jwt-secrets';

export const getJwtConfig = (configService: ConfigService): JwtModuleOptions => {
  return {
    secret: getJwtAccessSecret(configService),
    signOptions: {
      algorithm: 'HS256',
    },
    verifyOptions: {
      algorithms: ['HS256'],
      ignoreExpiration: false,
    },
  };
};
