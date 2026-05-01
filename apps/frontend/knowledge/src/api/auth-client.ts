import type { AuthTokens, CurrentUser, LoginRequest, LoginResponse } from '../types/api';
import { clearTokens, isRefreshTokenExpired, readTokens, saveTokens, shouldRefreshAccessToken } from './token-storage';

export interface AuthClientOptions {
  baseUrl: string;
  refreshBeforeMs?: number;
  fetcher?: typeof fetch;
  onAuthLost?: () => void;
}

export class AuthClient {
  private readonly baseUrl: string;
  private readonly refreshBeforeMs: number;
  private readonly fetcher: typeof fetch;
  private readonly onAuthLost?: () => void;
  private refreshPromise: Promise<AuthTokens> | undefined;

  constructor(options: AuthClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.refreshBeforeMs = options.refreshBeforeMs ?? 60_000;
    this.fetcher = options.fetcher ?? fetch;
    this.onAuthLost = options.onAuthLost;
  }

  async login(input: LoginRequest): Promise<LoginResponse> {
    const response = await this.fetcher(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    const session = await parseJson(response, parseLoginResponse);
    saveTokens(session.tokens);
    return session;
  }

  logout() {
    clearTokens();
  }

  async getCurrentUser(): Promise<CurrentUser> {
    const result = await this.requestWithAccessToken('/auth/me', parseMeResponse);
    return result.user;
  }

  private async requestWithAccessToken<T>(
    path: string,
    parser: ResponseParser<T>,
    init: RequestInit = {},
    hasRetried = false
  ): Promise<T> {
    const accessToken = await this.ensureValidAccessToken();
    if (!accessToken) {
      throw new Error('Missing access token');
    }
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: mergeHeaders(init.headers, { Authorization: `Bearer ${accessToken}` })
    });

    if (response.status === 401 && !hasRetried) {
      const errorBody = await readJson(response.clone());
      if (isAuthTokenExpired(errorBody)) {
        await this.refreshTokensOnce();
        return this.requestWithAccessToken(path, parser, init, true);
      }
    }

    return parseJson(response, parser);
  }

  getAccessToken() {
    return readTokens()?.accessToken ?? null;
  }

  getRefreshToken() {
    return readTokens()?.refreshToken ?? null;
  }

  hasTokens() {
    return Boolean(readTokens());
  }

  clearTokens() {
    clearTokens();
  }

  async ensureValidAccessToken(): Promise<string | null> {
    if (!readTokens()) {
      return null;
    }
    if (isRefreshTokenExpired()) {
      this.handleAuthLost();
      return null;
    }
    if (shouldRefreshAccessToken(this.refreshBeforeMs)) {
      await this.refreshTokensOnce();
    }
    return readTokens()?.accessToken ?? null;
  }

  refreshTokensOnce(): Promise<AuthTokens> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshTokens().finally(() => {
        this.refreshPromise = undefined;
      });
    }
    return this.refreshPromise;
  }

  async refreshTokens(): Promise<AuthTokens> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken || isRefreshTokenExpired()) {
      this.handleAuthLost();
      throw new Error('Refresh token expired');
    }
    try {
      const response = await this.fetcher(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      const result = await parseJson(response, parseRefreshTokenResponse);
      saveTokens(result.tokens);
      return result.tokens;
    } catch (error) {
      this.handleAuthLost();
      throw error;
    }
  }

  private handleAuthLost() {
    clearTokens();
    this.onAuthLost?.();
  }
}

type ResponseParser<T> = (body: unknown) => T | undefined;

async function parseJson<T>(response: Response, parser: ResponseParser<T>): Promise<T> {
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(getErrorMessage(body, response.status));
  }
  const result = parser(body);
  if (!result) {
    throw new Error('Invalid auth response');
  }
  return result;
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => undefined);
}

function getErrorMessage(body: unknown, status: number) {
  if (typeof body === 'object' && body && 'message' in body && typeof body.message === 'string') {
    return body.message;
  }
  return `HTTP ${status}`;
}

function isAuthTokenExpired(body: unknown) {
  return typeof body === 'object' && body && 'code' in body && body.code === 'auth_token_expired';
}

function mergeHeaders(input: HeadersInit | undefined, extra: Record<string, string>) {
  const headers = new Headers(input);
  for (const [key, value] of Object.entries(extra)) {
    headers.set(key, value);
  }
  return headers;
}

function parseLoginResponse(body: unknown): LoginResponse | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  const user = parseCurrentUser(body.user);
  const tokens = parseAuthTokens(body.tokens);
  return user && tokens ? { user, tokens } : undefined;
}

function parseRefreshTokenResponse(body: unknown): { tokens: AuthTokens } | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  const tokens = parseAuthTokens(body.tokens);
  return tokens ? { tokens } : undefined;
}

function parseMeResponse(body: unknown): { user: CurrentUser } | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  const user = parseCurrentUser(body.user);
  return user ? { user } : undefined;
}

function parseCurrentUser(input: unknown): CurrentUser | undefined {
  if (!isRecord(input) || typeof input.id !== 'string' || typeof input.email !== 'string') {
    return undefined;
  }
  if (!isWorkspaceRoleArray(input.roles) || !isStringArray(input.permissions)) {
    return undefined;
  }
  return {
    id: input.id,
    email: input.email,
    ...(typeof input.name === 'string' ? { name: input.name } : {}),
    ...(typeof input.avatarUrl === 'string' ? { avatarUrl: input.avatarUrl } : {}),
    ...(typeof input.currentWorkspaceId === 'string' ? { currentWorkspaceId: input.currentWorkspaceId } : {}),
    roles: input.roles,
    permissions: input.permissions
  };
}

function parseAuthTokens(input: unknown): AuthTokens | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  if (
    typeof input.accessToken !== 'string' ||
    typeof input.refreshToken !== 'string' ||
    input.tokenType !== 'Bearer' ||
    typeof input.expiresIn !== 'number' ||
    typeof input.refreshExpiresIn !== 'number'
  ) {
    return undefined;
  }
  return {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    tokenType: input.tokenType,
    expiresIn: input.expiresIn,
    refreshExpiresIn: input.refreshExpiresIn
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}

function isStringArray(input: unknown): input is string[] {
  return Array.isArray(input) && input.every(item => typeof item === 'string');
}

function isWorkspaceRoleArray(input: unknown): input is CurrentUser['roles'] {
  const allowed = new Set(['owner', 'admin', 'maintainer', 'evaluator', 'viewer']);
  return Array.isArray(input) && input.every(item => typeof item === 'string' && allowed.has(item));
}
