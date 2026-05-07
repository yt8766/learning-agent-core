import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

export const IDENTITY_JWT_OPTIONS = Symbol('IdentityJwtOptions');

export interface IdentityJwtProviderOptions {
  secret: string;
  issuer: string;
}

export interface IdentityJwtPayload {
  sub: string;
  sid: string;
  username: string;
  roles: string[];
  status: string;
  iss: string;
  aud: string[];
  exp: number;
}

@Injectable()
export class IdentityJwtProvider {
  constructor(@Inject(IDENTITY_JWT_OPTIONS) private readonly options: IdentityJwtProviderOptions) {}

  sign(payload: Omit<IdentityJwtPayload, 'iss'>): string {
    const header = encodeBase64Url({ alg: 'HS256', typ: 'JWT' });
    const body = encodeBase64Url({ ...payload, iss: this.options.issuer });
    return `${header}.${body}.${this.signSegment(`${header}.${body}`)}`;
  }

  verify(token: string): IdentityJwtPayload {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) {
      throw new Error('Invalid token');
    }
    if (signature !== this.signSegment(`${header}.${body}`)) {
      throw new Error('Invalid token signature');
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as IdentityJwtPayload;
    if (payload.iss !== this.options.issuer) {
      throw new Error('Invalid issuer');
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }
    return payload;
  }

  private signSegment(value: string): string {
    return createHmac('sha256', this.options.secret).update(value).digest('base64url');
  }
}

function encodeBase64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}
