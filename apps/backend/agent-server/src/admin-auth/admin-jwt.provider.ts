import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';

import { adminAuthError } from './admin-auth.errors';
import type {
  AdminAccessTokenPayload,
  AdminPrincipal,
  AdminRefreshTokenPayload
} from './interfaces/admin-auth-internal.types';

type SignAccessTokenInput = Omit<AdminAccessTokenPayload, 'tokenType' | 'iat' | 'exp'> & {
  ttlSeconds: number;
  now: Date;
};

type SignRefreshTokenInput = Omit<AdminRefreshTokenPayload, 'tokenType' | 'iat' | 'exp'> & {
  ttlSeconds: number;
  now: Date;
};

@Injectable()
export class AdminJwtProvider {
  private readonly secret: string;

  constructor(@Optional() @Inject('ADMIN_AUTH_JWT_SECRET') secret?: string) {
    this.secret = secret ?? process.env.ADMIN_AUTH_JWT_SECRET ?? 'dev-admin-auth-secret';
  }

  signAccessToken(input: SignAccessTokenInput): string {
    const iat = toEpochSeconds(input.now);
    return this.sign({
      sub: input.sub,
      sid: input.sid,
      username: input.username,
      roles: input.roles,
      tokenType: 'access',
      iat,
      exp: iat + input.ttlSeconds
    });
  }

  signRefreshToken(input: SignRefreshTokenInput): string {
    const iat = toEpochSeconds(input.now);
    return this.sign({
      sub: input.sub,
      sid: input.sid,
      rotationId: input.rotationId,
      tokenType: 'refresh',
      iat,
      exp: iat + input.ttlSeconds
    });
  }

  verifyAccessToken(token: string, now = new Date()): AdminAccessTokenPayload {
    const payload = this.verify(token, 'access');
    if (payload.tokenType !== 'access') {
      throw adminAuthError.accessTokenInvalid();
    }
    if (typeof payload.exp !== 'number' || payload.exp <= toEpochSeconds(now)) {
      throw adminAuthError.accessTokenExpired();
    }
    return payload as AdminAccessTokenPayload;
  }

  verifyRefreshToken(token: string, now = new Date()): AdminRefreshTokenPayload {
    const payload = this.verify(token, 'refresh');
    if (payload.tokenType !== 'refresh') {
      throw adminAuthError.refreshTokenInvalid();
    }
    if (typeof payload.exp !== 'number' || payload.exp <= toEpochSeconds(now)) {
      throw adminAuthError.refreshTokenExpired();
    }
    return payload as AdminRefreshTokenPayload;
  }

  toPrincipal(payload: AdminAccessTokenPayload): AdminPrincipal {
    return {
      accountId: payload.sub,
      sessionId: payload.sid,
      username: payload.username,
      roles: payload.roles
    };
  }

  createRotationId(): string {
    return `admin_rot_${randomUUID()}`;
  }

  private sign(payload: AdminAccessTokenPayload | AdminRefreshTokenPayload): string {
    const encodedHeader = encodeBase64Url({ alg: 'HS256', typ: 'JWT' });
    const encodedPayload = encodeBase64Url(payload);
    const signature = this.signature(`${encodedHeader}.${encodedPayload}`);
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private verify(token: string, kind: 'access' | 'refresh'): Record<string, unknown> {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !signature) {
      throw kind === 'access' ? adminAuthError.accessTokenInvalid() : adminAuthError.refreshTokenInvalid();
    }
    const expected = this.signature(`${encodedHeader}.${encodedPayload}`);
    if (signature !== expected) {
      throw kind === 'access' ? adminAuthError.accessTokenInvalid() : adminAuthError.refreshTokenInvalid();
    }
    try {
      return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Record<string, unknown>;
    } catch {
      throw kind === 'access' ? adminAuthError.accessTokenInvalid() : adminAuthError.refreshTokenInvalid();
    }
  }

  private signature(input: string): string {
    return createHmac('sha256', this.secret).update(input).digest('base64url');
  }
}

function encodeBase64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function toEpochSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
