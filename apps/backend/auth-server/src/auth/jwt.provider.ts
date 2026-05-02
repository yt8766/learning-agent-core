import { createHmac } from 'node:crypto';

export interface JwtProviderOptions {
  secret: string;
  issuer: string;
}

export interface AuthJwtPayload {
  sub: string;
  sid: string;
  username: string;
  roles: string[];
  status: string;
  iss: string;
  aud: string[];
  exp: number;
}

export class JwtProvider {
  constructor(private readonly options: JwtProviderOptions) {}

  sign(payload: Omit<AuthJwtPayload, 'iss'>): string {
    const header = encodeBase64Url({ alg: 'HS256', typ: 'JWT' });
    const body = encodeBase64Url({ ...payload, iss: this.options.issuer });
    return `${header}.${body}.${this.signSegment(`${header}.${body}`)}`;
  }

  verify(token: string): AuthJwtPayload {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) {
      throw new Error('Invalid token');
    }
    if (signature !== this.signSegment(`${header}.${body}`)) {
      throw new Error('Invalid token signature');
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AuthJwtPayload;
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
