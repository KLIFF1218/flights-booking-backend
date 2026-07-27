import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { JwtPayload } from 'src/modules/auth/interfaces';
import { assertUserNotBlocked } from 'src/common/utils/assert-user-active';
import { getJwtAccessSecret } from 'src/config/jwt-secrets';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly prismaService: PrismaService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: getJwtAccessSecret(configService),
      ignoreExpiration: false,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.typ !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prismaService.user.findUnique({
      where: {
        id: payload.id,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        vkId: true,
        status: true,
        phone: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    assertUserNotBlocked(user.status);

    return user;
  }
}
