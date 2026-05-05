import type { AuthTokens, CurrentUser, LoginRequest, LoginResponse } from '../types/api';
import { clearTokens, readTokens, saveTokens, type StoredTokens } from './token-storage';

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
  private onAuthLost?: () => void;
  private refreshPromise: Promise<AuthTokens> | undefined;
  private cachedTokens: StoredTokens | undefined;

  constructor(options: AuthClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.refreshBeforeMs = options.refreshBeforeMs ?? 60_000;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.onAuthLost = options.onAuthLost;
    this.cachedTokens = readTokens();
  }

  async login(input: LoginRequest): Promise<LoginResponse> {
    const response = await this.fetcher(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: input.username ?? input.email,
        password: input.password,
        remember: input.remember ?? true
      })
    });
    const session = await parseJson(response, parseLoginResponse);
    this.setTokens(session.tokens);
    return session;
  }

  logout() {
    this.clearAuthTokens();
  }

  setAuthLostHandler(handler: (() => void) | undefined) {
    this.onAuthLost = handler;
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
    return this.cachedTokens?.accessToken ?? null;
  }

  getRefreshToken() {
    return this.cachedTokens?.refreshToken ?? null;
  }

  hasTokens() {
    return Boolean(this.cachedTokens);
  }

  clearTokens() {
    this.clearAuthTokens();
  }

  async ensureValidAccessToken(): Promise<string | null> {
    if (!this.cachedTokens) {
      return null;
    }
    if (this.isRefreshTokenExpired()) {
      this.handleAuthLost();
      return null;
    }
    if (this.shouldRefreshAccessToken()) {
      await this.refreshTokensOnce();
    }
    return this.cachedTokens?.accessToken ?? null;
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
    if (!refreshToken || this.isRefreshTokenExpired()) {
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
      this.setTokens(result.tokens);
      return result.tokens;
    } catch (error) {
      this.handleAuthLost();
      throw error;
    }
  }

  private handleAuthLost() {
    this.clearAuthTokens();
    this.onAuthLost?.();
  }

  private setTokens(tokens: AuthTokens) {
    saveTokens(tokens);
    this.cachedTokens = readTokens();
  }

  private clearAuthTokens() {
    clearTokens();
    this.cachedTokens = undefined;
  }

  private shouldRefreshAccessToken(now = Date.now()) {
    return !this.cachedTokens || now >= this.cachedTokens.accessTokenExpiresAt - this.refreshBeforeMs;
  }

  private isRefreshTokenExpired(now = Date.now()) {
    return !this.cachedTokens || now >= this.cachedTokens.refreshTokenExpiresAt;
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
  if (!isRecord(body)) {
    return false;
  }
  if (body.code === 'auth_token_expired' || body.code === 'access_token_expired') {
    return true;
  }
  return isRecord(body.error) && body.error.code === 'access_token_expired';
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
  const user = parseCurrentUser(body.user ?? body.account);
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
  const user = parseCurrentUser(body.user ?? body.account);
  return user ? { user } : undefined;
}

function parseCurrentUser(input: unknown): CurrentUser | undefined {
  if (!isRecord(input) || typeof input.id !== 'string') {
    return undefined;
  }
  const roles = mapWorkspaceRoles(input.roles);
  if (!roles) {
    return undefined;
  }
  return {
    id: input.id,
    email: typeof input.email === 'string' ? input.email : String(input.username ?? input.id),
    ...(typeof input.name === 'string' ? { name: input.name } : {}),
    ...(typeof input.displayName === 'string' ? { name: input.displayName } : {}),
    ...(typeof input.avatarUrl === 'string' ? { avatarUrl: input.avatarUrl } : {}),
    ...(typeof input.currentWorkspaceId === 'string' ? { currentWorkspaceId: input.currentWorkspaceId } : {}),
    roles,
    permissions: isStringArray(input.permissions) ? input.permissions : []
  };
}

function parseAuthTokens(input: unknown): AuthTokens | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  if (typeof input.accessToken !== 'string' || typeof input.refreshToken !== 'string' || input.tokenType !== 'Bearer') {
    return undefined;
  }
  const expiresIn = typeof input.expiresIn === 'number' ? input.expiresIn : secondsUntilIso(input.accessTokenExpiresAt);
  const refreshExpiresIn =
    typeof input.refreshExpiresIn === 'number' ? input.refreshExpiresIn : secondsUntilIso(input.refreshTokenExpiresAt);
  if (expiresIn === undefined || refreshExpiresIn === undefined) {
    return undefined;
  }
  return {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    tokenType: input.tokenType,
    expiresIn,
    refreshExpiresIn,
    ...(typeof input.accessTokenExpiresAt === 'string' ? { accessTokenExpiresAt: input.accessTokenExpiresAt } : {}),
    ...(typeof input.refreshTokenExpiresAt === 'string' ? { refreshTokenExpiresAt: input.refreshTokenExpiresAt } : {})
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

function mapWorkspaceRoles(input: unknown): CurrentUser['roles'] | undefined {
  if (isWorkspaceRoleArray(input)) {
    return input;
  }
  if (!Array.isArray(input) || !input.every(item => typeof item === 'string')) {
    return undefined;
  }
  if (input.includes('super_admin') || input.includes('admin')) {
    return ['admin'];
  }
  if (input.includes('knowledge_user')) {
    return ['viewer'];
  }
  return ['viewer'];
}

function secondsUntilIso(input: unknown): number | undefined {
  if (typeof input !== 'string') {
    return undefined;
  }
  const timestamp = new Date(input).getTime();
  if (!Number.isFinite(timestamp)) {
    return undefined;
  }
  return Math.max(0, Math.floor((timestamp - Date.now()) / 1000));
}
