import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AdminRole } from './admin-role.enum';

interface AdminJwtPayload {
  sub: string;
  role: AdminRole;
}

@Injectable()
export class JwtAdminStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ADMIN_SECRET')!,
    });
  }

  validate(payload: AdminJwtPayload) {
    return { userId: payload.sub, role: payload.role };
  }
}
