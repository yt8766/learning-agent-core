import type {
  AuthAccount,
  AuthLoginRequest,
  AuthLoginResponse,
  AuthMeResponse,
  AuthRefreshResponse,
  AdminLoginRequest,
  AdminLoginResponse,
  AdminLogoutRequest,
  AdminLogoutResponse,
  AdminMeResponse,
  AdminAccount,
  AdminRefreshResponse
} from '@agent/core';

const AUTH_SERVICE_BASE_URL = import.meta.env.VITE_AUTH_SERVICE_BASE_URL ?? 'http://127.0.0.1:3000/api';

export function loginAdminAuth(input: AdminLoginRequest): Promise<AdminLoginResponse> {
  return requestAuthService<AuthLoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ ...input, remember: input.remember ?? false } satisfies AuthLoginRequest)
  }).then(mapLoginResponse);
}

export function refreshAdminAuth(refreshToken?: string): Promise<AdminRefreshResponse> {
  return requestAuthService<AuthRefreshResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify(refreshToken ? { refreshToken } : {})
  });
}

export function logoutAdminAuth(input: AdminLogoutRequest): Promise<AdminLogoutResponse> {
  return requestAuthService<AdminLogoutResponse>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function getAdminMe(): Promise<AdminMeResponse> {
  return requestAuthService<AuthMeResponse>('/auth/me', {
    headers: authHeader()
  }).then(response => ({ account: mapAccount(response.account) }));
}

async function requestAuthService<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${AUTH_SERVICE_BASE_URL.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: mergeHeaders(init.headers, { 'Content-Type': 'application/json' })
  });
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(readAuthErrorCode(body) ?? `HTTP ${response.status}`);
  }
  return body as T;
}

function mapLoginResponse(response: AuthLoginResponse): AdminLoginResponse {
  return {
    account: mapAccount(response.account),
    session: response.session,
    tokens: response.tokens
  };
}

function mapAccount(account: AuthAccount): AdminAccount {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    roles: account.roles.includes('super_admin') ? ['super_admin'] : ['developer'],
    status: account.status
  };
}

function authHeader(): Record<string, string> {
  const raw = localStorage.getItem('agent-admin:auth');
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as { tokens?: { accessToken?: string } };
    return parsed.tokens?.accessToken ? { Authorization: `Bearer ${parsed.tokens.accessToken}` } : {};
  } catch {
    return {};
  }
}

function mergeHeaders(input: HeadersInit | undefined, extra: Record<string, string>) {
  const headers = new Headers(input);
  for (const [key, value] of Object.entries(extra)) {
    headers.set(key, value);
  }
  return headers;
}

function readAuthErrorCode(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return undefined;
  }
  const error = (body as { error?: { code?: unknown } }).error;
  return typeof error?.code === 'string' ? error.code : undefined;
}
