import { createHmac } from 'node:crypto';

export interface AuthTokenVerifierOptions {
  secret: string;
  issuer: string;
  audience: string;
}

interface AuthJwtPayload {
  sub: string;
  username: string;
  roles: string[];
  status: string;
  iss: string;
  aud: string[];
  exp: number;
}

export interface KnowledgeAuthUser {
  userId: string;
  username: string;
  roles: string[];
}

export class AuthTokenVerifier {
  constructor(private readonly options: AuthTokenVerifierOptions) {}

  verify(token: string): KnowledgeAuthUser {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) {
      throw new Error('Invalid token');
    }
    if (signature !== this.signSegment(`${header}.${body}`)) {
      throw new Error('Invalid signature');
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AuthJwtPayload;
    if (payload.iss !== this.options.issuer) {
      throw new Error('Invalid issuer');
    }
    if (!payload.aud.includes(this.options.audience)) {
      throw new Error('Invalid audience');
    }
    if (payload.status !== 'enabled') {
      throw new Error('Account disabled');
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }
    return { userId: payload.sub, username: payload.username, roles: payload.roles };
  }

  signForTest(payload: Omit<AuthJwtPayload, 'iss'>): string {
    const header = encodeBase64Url({ alg: 'HS256', typ: 'JWT' });
    const body = encodeBase64Url({ ...payload, iss: this.options.issuer });
    return `${header}.${body}.${this.signSegment(`${header}.${body}`)}`;
  }

  private signSegment(value: string): string {
    return createHmac('sha256', this.options.secret).update(value).digest('base64url');
  }
}

function encodeBase64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}
