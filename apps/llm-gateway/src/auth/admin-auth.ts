import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { redirect } from 'next/navigation';
import type { AdminCredential, AdminPrincipal, AdminTokenPair, AdminAuthErrorCode } from '../contracts/admin-auth';
import { createMemoryAdminAuthRepository, type AdminAuthRepository } from '../repositories/admin-auth';
import { createPostgresAdminAuthRepository } from '../repositories/postgres-admin-auth';
import { hashAdminPassword, verifyAdminPassword } from './admin-password';
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

type TokenType = 'access' | 'refresh';

interface AdminTokenPayload {
  sub: string;
  role: 'owner';
  typ: TokenType;
  atv: number;
  rtv: number;
  iat: number;
  exp: number;
}

export interface CreateAdminAuthServiceOptions {
  repository: AdminAuthRepository;
  jwtSecret: string;
  bootstrapPassword?: string;
  now?: () => Date;
}

export interface AdminAuthService {
  readonly repository: AdminAuthRepository;
  ensureOwnerPassword(input: { password: string; displayName?: string }): Promise<AdminPrincipal>;
  login(input: { password: string }): Promise<AdminTokenPair>;
  refresh(input: { refreshToken: string }): Promise<AdminTokenPair>;
  changePassword(input: {
    authorization: string | null;
    currentPassword: string;
    newPassword: string;
  }): Promise<AdminTokenPair>;
  requireAccessToken(authorization: string | null): Promise<AdminPrincipal>;
}

let routeService: AdminAuthService | null = null;

export function setAdminAuthServiceForRoutes(service: AdminAuthService | null): void {
  routeService = service;
}

export function getAdminAuthServiceForRoutes(): AdminAuthService {
  if (!routeService) {
    routeService = createBootstrapAdminAuthService();
  }

  return routeService;
}

export function createAdminAuthService(options: CreateAdminAuthServiceOptions): AdminAuthService {
  const now = options.now ?? (() => new Date());

  async function loadActiveOwner(): Promise<{ principal: AdminPrincipal; credential: AdminCredential }> {
    const principal = (await options.repository.findOwnerPrincipal()) ?? (await bootstrapOwner());
    if (!principal) {
      throw new AdminAuthError('admin_auth_not_configured', 'Admin owner credential is not configured.', 503);
    }

    if (principal.status !== 'active') {
      throw new AdminAuthError('admin_principal_disabled', 'Admin principal is disabled.', 403);
    }

    const credential = await options.repository.findPasswordCredential(principal.id);
    if (!credential) {
      throw new AdminAuthError('admin_auth_not_configured', 'Admin password credential is not configured.', 503);
    }

    return { principal, credential };
  }

  async function bootstrapOwner(): Promise<AdminPrincipal | null> {
    if (!isConfiguredSecret(options.bootstrapPassword)) {
      return null;
    }

    return ensureOwnerPassword({ password: options.bootstrapPassword, displayName: 'Owner' });
  }

  async function issueTokenPair(principal: AdminPrincipal): Promise<AdminTokenPair> {
    const issuedAt = toEpochSeconds(now());
    const accessTokenExpiresAt = new Date((issuedAt + ACCESS_TOKEN_TTL_SECONDS) * 1000).toISOString();
    const refreshTokenExpiresAt = new Date((issuedAt + REFRESH_TOKEN_TTL_SECONDS) * 1000).toISOString();

    return {
      accessToken: signJwt(
        {
          sub: principal.id,
          role: principal.role,
          typ: 'access',
          atv: principal.accessTokenVersion,
          rtv: principal.refreshTokenVersion,
          iat: issuedAt,
          exp: issuedAt + ACCESS_TOKEN_TTL_SECONDS
        },
        options.jwtSecret
      ),
      refreshToken: signJwt(
        {
          sub: principal.id,
          role: principal.role,
          typ: 'refresh',
          atv: principal.accessTokenVersion,
          rtv: principal.refreshTokenVersion,
          iat: issuedAt,
          exp: issuedAt + REFRESH_TOKEN_TTL_SECONDS
        },
        options.jwtSecret
      ),
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      principal
    };
  }

  async function verifyToken(token: string, expectedType: TokenType): Promise<AdminPrincipal> {
    const payload = verifyJwt(token, options.jwtSecret);
    const currentEpoch = toEpochSeconds(now());

    if (payload.typ !== expectedType) {
      throw invalidTokenError(expectedType);
    }

    if (payload.exp <= currentEpoch) {
      throw expiredTokenError(expectedType);
    }

    const principal = await options.repository.findPrincipalById(payload.sub);
    if (!principal || principal.role !== payload.role) {
      throw invalidTokenError(expectedType);
    }

    if (principal.status !== 'active') {
      throw new AdminAuthError('admin_principal_disabled', 'Admin principal is disabled.', 403);
    }

    if (principal.accessTokenVersion !== payload.atv || principal.refreshTokenVersion !== payload.rtv) {
      throw invalidTokenError(expectedType);
    }

    return principal;
  }

  async function ensureOwnerPassword(input: { password: string; displayName?: string }): Promise<AdminPrincipal> {
    const existing = await options.repository.findOwnerPrincipal();
    if (existing) {
      return existing;
    }

    const timestamp = now().toISOString();
    const principal: AdminPrincipal = {
      id: `admin_${randomUUID()}`,
      role: 'owner',
      displayName: input.displayName ?? 'Owner',
      status: 'active',
      accessTokenVersion: 1,
      refreshTokenVersion: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastLoginAt: null
    };
    const credential: AdminCredential = {
      id: `cred_${randomUUID()}`,
      principalId: principal.id,
      kind: 'password',
      passwordHash: await hashAdminPassword(input.password),
      passwordUpdatedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await options.repository.savePrincipal(principal);
    await options.repository.saveCredential(credential);
    return principal;
  }

  return {
    repository: options.repository,
    ensureOwnerPassword,
    async login(input) {
      const { principal, credential } = await loadActiveOwner();
      const passwordMatches = await verifyAdminPassword(input.password, credential.passwordHash);

      if (!passwordMatches) {
        throw new AdminAuthError('admin_login_invalid_password', 'Admin password is invalid.', 401);
      }

      const updatedPrincipal = {
        ...principal,
        lastLoginAt: now().toISOString(),
        updatedAt: now().toISOString()
      };
      await options.repository.savePrincipal(updatedPrincipal);
      return issueTokenPair(updatedPrincipal);
    },
    async refresh(input) {
      const principal = await verifyToken(input.refreshToken, 'refresh');
      return issueTokenPair(principal);
    },
    async changePassword(input) {
      const principal = await verifyToken(readBearerToken(input.authorization), 'access');
      const credential = await options.repository.findPasswordCredential(principal.id);

      if (!credential || !(await verifyAdminPassword(input.currentPassword, credential.passwordHash))) {
        throw new AdminAuthError('admin_current_password_invalid', 'Current admin password is invalid.', 401);
      }

      const timestamp = now().toISOString();
      const updatedPrincipal = {
        ...principal,
        accessTokenVersion: principal.accessTokenVersion + 1,
        refreshTokenVersion: principal.refreshTokenVersion + 1,
        updatedAt: timestamp
      };
      const updatedCredential = {
        ...credential,
        passwordHash: await hashAdminPassword(input.newPassword),
        passwordUpdatedAt: timestamp,
        updatedAt: timestamp
      };

      await options.repository.savePrincipal(updatedPrincipal);
      await options.repository.saveCredential(updatedCredential);
      return issueTokenPair(updatedPrincipal);
    },
    async requireAccessToken(authorization) {
      return verifyToken(readBearerToken(authorization), 'access');
    }
  };
}

export async function requireAdminSession(): Promise<void> {
  redirect('/admin/login?reason=browser-token-required');
}

export function getAdminSessionCookieName(): string {
  return '';
}

export class AdminAuthError extends Error {
  readonly code: AdminAuthErrorCode;
  readonly status: number;

  constructor(code: AdminAuthErrorCode, message: string, status: number) {
    super(message);
    this.name = 'AdminAuthError';
    this.code = code;
    this.status = status;
  }
}

export function adminAuthErrorResponse(error: unknown): Response {
  const authError = toAdminAuthError(error);
  return Response.json(
    {
      error: {
        code: authError.code,
        message: authError.message,
        type: 'admin_auth_error'
      }
    },
    { status: authError.status }
  );
}

function toAdminAuthError(error: unknown): AdminAuthError {
  if (error instanceof AdminAuthError) {
    return error;
  }

  return new AdminAuthError('admin_auth_bad_request', 'Admin auth request failed.', 400);
}

function createBootstrapAdminAuthService(): AdminAuthService {
  const jwtSecret = process.env.LLM_GATEWAY_ADMIN_JWT_SECRET;
  const bootstrapPassword = process.env.LLM_GATEWAY_BOOTSTRAP_ADMIN_PASSWORD;
  const databaseUrl = process.env.DATABASE_URL;

  if (!isConfiguredSecret(jwtSecret)) {
    throw new AdminAuthError('admin_auth_not_configured', 'Set LLM_GATEWAY_ADMIN_JWT_SECRET.', 503);
  }

  const repository = databaseUrl ? createPostgresAdminAuthRepository(databaseUrl) : createMemoryAdminAuthRepository();
  return createAdminAuthService({
    repository,
    jwtSecret,
    bootstrapPassword: isConfiguredSecret(bootstrapPassword) ? bootstrapPassword : undefined
  });
}

function signJwt(payload: AdminTokenPayload, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const signingInput = `${encodeJson(header)}.${encodeJson(payload)}`;
  return `${signingInput}.${sign(signingInput, secret)}`;
}

function verifyJwt(token: string, secret: string): AdminTokenPayload {
  const [encodedHeader, encodedPayload, signature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !signature) {
    throw new AdminAuthError('admin_access_token_invalid', 'Admin token is invalid.', 401);
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = sign(signingInput, secret);
  if (!constantTimeEqual(signature, expectedSignature)) {
    throw new AdminAuthError('admin_access_token_invalid', 'Admin token is invalid.', 401);
  }

  const header = decodeJson(encodedHeader) as { alg?: unknown; typ?: unknown };
  const payload = decodeJson(encodedPayload) as Partial<AdminTokenPayload>;
  if (header.alg !== 'HS256' || header.typ !== 'JWT' || !isTokenPayload(payload)) {
    throw new AdminAuthError('admin_access_token_invalid', 'Admin token is invalid.', 401);
  }

  return payload;
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeJson(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new AdminAuthError('admin_access_token_invalid', 'Admin token is invalid.', 401);
  }
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isTokenPayload(payload: Partial<AdminTokenPayload>): payload is AdminTokenPayload {
  return (
    typeof payload.sub === 'string' &&
    payload.role === 'owner' &&
    (payload.typ === 'access' || payload.typ === 'refresh') &&
    typeof payload.atv === 'number' &&
    typeof payload.rtv === 'number' &&
    typeof payload.iat === 'number' &&
    typeof payload.exp === 'number'
  );
}

function readBearerToken(authorization: string | null): string {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new AdminAuthError('admin_access_token_missing', 'Admin access token is required.', 401);
  }

  return match[1];
}

function invalidTokenError(expectedType: TokenType): AdminAuthError {
  return new AdminAuthError(
    expectedType === 'access' ? 'admin_access_token_invalid' : 'admin_refresh_token_invalid',
    'Admin token is invalid.',
    401
  );
}

function expiredTokenError(expectedType: TokenType): AdminAuthError {
  return new AdminAuthError(
    expectedType === 'access' ? 'admin_access_token_expired' : 'admin_refresh_token_expired',
    'Admin token has expired.',
    expectedType === 'access' ? 403 : 401
  );
}

function toEpochSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function isConfiguredSecret(value: string | undefined): value is string {
  return Boolean(value && !value.startsWith('replace-with-'));
}
