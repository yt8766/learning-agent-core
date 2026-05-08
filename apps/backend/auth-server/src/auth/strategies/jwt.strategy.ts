import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AuthJwtPayload } from '../jwt.provider';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.AUTH_SERVER_JWT_SECRET ?? 'local-dev-auth-secret',
      issuer: process.env.AUTH_SERVER_JWT_ISSUER ?? 'auth-server'
    });
  }

  validate(payload: AuthJwtPayload): AuthJwtPayload {
    return payload;
  }
}
