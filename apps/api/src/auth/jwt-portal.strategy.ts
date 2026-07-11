import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface PortalJwtPayload {
  sub: string;
  customerId: string;
}

@Injectable()
export class JwtPortalStrategy extends PassportStrategy(Strategy, 'jwt-portal') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_PORTAL_SECRET')!,
    });
  }

  validate(payload: PortalJwtPayload) {
    return { portalUserId: payload.sub, customerId: payload.customerId };
  }
}
