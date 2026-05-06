import { KnowledgeAuthSessionSchema, KnowledgeRefreshSessionSchema, type KnowledgeAuthTokens } from '../core';

export interface KnowledgeTokenStore {
  getTokens(): KnowledgeAuthTokens | null | Promise<KnowledgeAuthTokens | null>;
  setTokens(tokens: KnowledgeAuthTokens): void | Promise<void>;
  clearTokens?(): void | Promise<void>;
}

export interface KnowledgeApiClientOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
  refreshPath?: string;
  tokenStore?: KnowledgeTokenStore;
}

export interface KnowledgeRequestOptions<T> extends Omit<RequestInit, 'body'> {
  body?: KnowledgeRequestBody | JsonRecord;
  parse?: (value: unknown) => T;
}

type JsonRecord = Record<string, unknown>;
type KnowledgeRequestBody = Exclude<RequestInit['body'], null | undefined>;

export class KnowledgeApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, message: string, options: { code?: string; details?: unknown } = {}) {
    super(message);
    this.name = 'KnowledgeApiError';
    this.status = status;
    this.code = options.code;
    this.details = options.details;
  }
}

export class KnowledgeApiClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly refreshPath: string;
  private readonly tokenStore?: KnowledgeTokenStore;
  private refreshPromise: Promise<KnowledgeAuthTokens | null> | null = null;

  constructor(options: KnowledgeApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetcher = options.fetcher ?? fetch;
    this.refreshPath = options.refreshPath ?? '/auth/refresh';
    this.tokenStore = options.tokenStore;
  }

  async get<T>(path: string, options: Omit<KnowledgeRequestOptions<T>, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async post<T>(path: string, body?: JsonRecord, options: Omit<KnowledgeRequestOptions<T>, 'method' | 'body'> = {}) {
    return this.request<T>(path, { ...options, body, method: 'POST' });
  }

  async put<T>(path: string, body?: JsonRecord, options: Omit<KnowledgeRequestOptions<T>, 'method' | 'body'> = {}) {
    return this.request<T>(path, { ...options, body, method: 'PUT' });
  }

  async delete<T>(path: string, options: Omit<KnowledgeRequestOptions<T>, 'method' | 'body'> = {}) {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  async request<T>(path: string, options: KnowledgeRequestOptions<T> = {}, hasRetried = false): Promise<T> {
    const tokens = await this.tokenStore?.getTokens();
    const response = await this.fetchJson(path, options, tokens?.accessToken);

    if (response.ok) {
      const body = await readJson(response);
      return options.parse ? options.parse(body) : (body as T);
    }

    const errorBody = await readJson(response);
    if (response.status === 401 && !hasRetried && isAuthTokenExpired(errorBody)) {
      const refreshedTokens = await this.refreshTokensOnce();
      if (refreshedTokens) {
        return this.request<T>(path, options, true);
      }
    }

    if (response.status === 401) {
      await this.tokenStore?.clearTokens?.();
    }

    throw toKnowledgeApiError(response.status, errorBody);
  }

  async refreshTokensOnce(): Promise<KnowledgeAuthTokens | null> {
    if (!this.tokenStore) {
      return null;
    }
    this.refreshPromise ??= this.refreshTokens().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async refreshTokens(): Promise<KnowledgeAuthTokens | null> {
    const tokenStore = this.tokenStore;
    const currentTokens = await this.tokenStore?.getTokens();
    if (!currentTokens?.refreshToken) {
      await tokenStore?.clearTokens?.();
      return null;
    }

    const response = await this.fetchJson(this.refreshPath, {
      body: { refreshToken: currentTokens.refreshToken },
      method: 'POST'
    });
    const body = await readJson(response);

    if (!response.ok) {
      await this.tokenStore?.clearTokens?.();
      return null;
    }

    const refreshPayload = KnowledgeRefreshSessionSchema.or(KnowledgeAuthSessionSchema).parse(body);
    await tokenStore?.setTokens(refreshPayload.tokens);
    return refreshPayload.tokens;
  }

  private fetchJson(path: string, options: KnowledgeRequestOptions<unknown>, accessToken?: string) {
    const headers = new Headers(options.headers);
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const init: RequestInit = {
      ...options,
      body: serializeBody(options.body, headers),
      headers
    };

    return this.fetcher(`${this.baseUrl}${path}`, init);
  }
}

function serializeBody(
  body: KnowledgeRequestOptions<unknown>['body'],
  headers: Headers
): KnowledgeRequestBody | undefined {
  if (!body) {
    return undefined;
  }
  if (typeof body === 'string' || body instanceof Blob || body instanceof FormData || body instanceof URLSearchParams) {
    return body;
  }
  headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json');
  return JSON.stringify(body);
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isAuthTokenExpired(body: unknown): boolean {
  if (!body || typeof body !== 'object') {
    return false;
  }
  const code = 'code' in body ? body.code : undefined;
  return code === 'auth_token_expired';
}

function toKnowledgeApiError(status: number, body: unknown): KnowledgeApiError {
  if (body && typeof body === 'object') {
    const message =
      'message' in body && typeof body.message === 'string' ? body.message : `Knowledge API failed: ${status}`;
    const code = 'code' in body && typeof body.code === 'string' ? body.code : undefined;
    return new KnowledgeApiError(status, message, { code, details: body });
  }
  return new KnowledgeApiError(status, typeof body === 'string' ? body : `Knowledge API failed: ${status}`, {
    details: body
  });
}
