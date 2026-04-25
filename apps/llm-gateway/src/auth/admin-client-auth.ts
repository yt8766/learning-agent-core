export const ADMIN_AUTH_STORAGE_KEY = 'llm_gateway_admin_auth';

export interface AdminStoredAuth {
  principal: {
    id: string;
    displayName?: string;
    [key: string]: unknown;
  };
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface AdminLoginInput {
  password: string;
}

export interface AdminChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export class AdminClientAuthError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'AdminClientAuthError';
    this.code = code;
    this.status = status;
  }
}

interface AdminClientAuthOptions {
  fetch?: typeof fetch;
  storage?: Storage;
}

let refreshInFlight: Promise<AdminStoredAuth | null> | null = null;

export function getStoredAdminAuth(storage = resolveStorage()): AdminStoredAuth | null {
  const raw = storage?.getItem(ADMIN_AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AdminStoredAuth;
  } catch {
    storage?.removeItem(ADMIN_AUTH_STORAGE_KEY);
    return null;
  }
}

export function setStoredAdminAuth(auth: AdminStoredAuth, storage = resolveStorage()): void {
  storage?.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearStoredAdminAuth(storage = resolveStorage()): void {
  storage?.removeItem(ADMIN_AUTH_STORAGE_KEY);
}

export async function loginAdmin(
  input: AdminLoginInput,
  options: AdminClientAuthOptions = {}
): Promise<AdminStoredAuth> {
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl('/api/admin/auth/login', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw await readAdminClientAuthError(response, 'admin_login_failed');
  }

  const auth = (await response.json()) as AdminStoredAuth;
  setStoredAdminAuth(auth, options.storage);
  return auth;
}

export async function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: AdminClientAuthOptions = {}
): Promise<Response> {
  return adminFetchWithReplay(input, init, options, false);
}

export async function changeAdminPassword(
  input: AdminChangePasswordInput,
  options: AdminClientAuthOptions = {}
): Promise<void> {
  const response = await adminFetch(
    '/api/admin/auth/change-password',
    {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(input)
    },
    options
  );

  if (!response.ok) {
    throw await readAdminClientAuthError(response, 'admin_change_password_failed');
  }
}

export async function logoutAdmin(options: AdminClientAuthOptions = {}): Promise<void> {
  try {
    await adminFetch(
      '/api/admin/auth/logout',
      {
        method: 'POST',
        headers: jsonHeaders()
      },
      options
    );
  } finally {
    clearStoredAdminAuth(options.storage);
  }
}

async function adminFetchWithReplay(
  input: RequestInfo | URL,
  init: RequestInit,
  options: AdminClientAuthOptions,
  alreadyReplayed: boolean
): Promise<Response> {
  const fetchImpl = options.fetch ?? fetch;
  const auth = getStoredAdminAuth(options.storage);
  const response = await fetchImpl(input, withAdminAuthorization(init, auth?.accessToken));

  if (alreadyReplayed || !(await isExpiredAccessTokenResponse(response))) {
    return response;
  }

  const refreshedAuth = await refreshAdminAuth(options);
  if (!refreshedAuth) {
    return response;
  }

  return adminFetchWithReplay(input, init, options, true);
}

async function refreshAdminAuth(options: AdminClientAuthOptions): Promise<AdminStoredAuth | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = refreshAdminAuthOnce(options).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function refreshAdminAuthOnce(options: AdminClientAuthOptions): Promise<AdminStoredAuth | null> {
  const auth = getStoredAdminAuth(options.storage);
  if (!auth) {
    return null;
  }

  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl('/api/admin/auth/refresh', {
    method: 'POST',
    headers: withBearer(jsonHeaders(), auth.accessToken),
    body: JSON.stringify({ refreshToken: auth.refreshToken })
  });

  if (!response.ok) {
    clearStoredAdminAuth(options.storage);
    return null;
  }

  const refreshedAuth = (await response.json()) as AdminStoredAuth;
  setStoredAdminAuth(refreshedAuth, options.storage);
  return refreshedAuth;
}

async function isExpiredAccessTokenResponse(response: Response): Promise<boolean> {
  if (response.status !== 403) {
    return false;
  }

  try {
    const payload = (await response.clone().json()) as { error?: { code?: string } };
    return payload.error?.code === 'admin_access_token_expired';
  } catch {
    return false;
  }
}

async function readAdminClientAuthError(response: Response, fallbackCode: string): Promise<AdminClientAuthError> {
  try {
    const payload = (await response.clone().json()) as { error?: { code?: string; message?: string } };
    const code = payload.error?.code ?? fallbackCode;
    const message = payload.error?.message ?? fallbackCode;
    return new AdminClientAuthError(code, message, response.status);
  } catch {
    return new AdminClientAuthError(fallbackCode, fallbackCode, response.status);
  }
}

function withAdminAuthorization(init: RequestInit, accessToken?: string): RequestInit {
  if (!accessToken) {
    return init;
  }

  return {
    ...init,
    headers: withBearer(new Headers(init.headers), accessToken)
  };
}

function withBearer(headers: Headers, accessToken: string): Headers {
  headers.set('authorization', `Bearer ${accessToken}`);
  return headers;
}

function jsonHeaders(): Headers {
  const headers = new Headers();
  headers.set('content-type', 'application/json');
  return headers;
}

function resolveStorage(): Storage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}
