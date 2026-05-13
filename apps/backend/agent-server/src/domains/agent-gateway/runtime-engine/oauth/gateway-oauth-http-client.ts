export interface GatewayOAuthHttpExchangeRequest {
  providerId: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  code: string;
  redirectUri: string;
  scopes: string[];
}

export interface GatewayOAuthHttpDeviceStartRequest {
  providerId: string;
  deviceUrl: string;
  clientId: string;
  clientSecret?: string;
  scopes: string[];
}

export interface GatewayOAuthHttpDeviceTokenRequest {
  providerId: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  deviceCode: string;
  scopes: string[];
}

export interface GatewayOAuthHttpTokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  scope?: string;
  accountEmail?: string | null;
  projectId?: string | null;
}

export interface GatewayOAuthHttpPendingDeviceResponse {
  error: 'authorization_pending' | 'slow_down';
  interval?: number;
}

export interface GatewayOAuthHttpDeviceStartResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval?: number;
}

export interface GatewayOAuthHttpClient {
  exchangeAuthorizationCode(request: GatewayOAuthHttpExchangeRequest): Promise<GatewayOAuthHttpTokenResponse>;
  startDeviceAuthorization(request: GatewayOAuthHttpDeviceStartRequest): Promise<GatewayOAuthHttpDeviceStartResponse>;
  pollDeviceToken(
    request: GatewayOAuthHttpDeviceTokenRequest
  ): Promise<GatewayOAuthHttpTokenResponse | GatewayOAuthHttpPendingDeviceResponse>;
}

export type GatewayOAuthFetch = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string }
) => Promise<{
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}>;

export class FetchGatewayOAuthHttpClient implements GatewayOAuthHttpClient {
  constructor(private readonly fetchFn: GatewayOAuthFetch = fetchOAuth) {}

  async exchangeAuthorizationCode(request: GatewayOAuthHttpExchangeRequest): Promise<GatewayOAuthHttpTokenResponse> {
    const body = formBody({
      grant_type: 'authorization_code',
      client_id: request.clientId,
      client_secret: request.clientSecret,
      code: request.code,
      redirect_uri: request.redirectUri,
      scope: request.scopes.join(' ')
    });
    return normalizeTokenResponse(await this.postForm(request.tokenUrl, body));
  }

  async startDeviceAuthorization(
    request: GatewayOAuthHttpDeviceStartRequest
  ): Promise<GatewayOAuthHttpDeviceStartResponse> {
    const body = formBody({
      client_id: request.clientId,
      client_secret: request.clientSecret,
      scope: request.scopes.join(' ')
    });
    const raw = asRecord(await this.postForm(request.deviceUrl, body));
    return {
      deviceCode: stringValue(raw.device_code ?? raw.deviceCode, 'device_code'),
      userCode: stringValue(raw.user_code ?? raw.userCode, 'user_code'),
      verificationUri: stringValue(
        raw.verification_uri ?? raw.verificationUri ?? raw.verification_url,
        'verification_uri'
      ),
      expiresIn: numberValue(raw.expires_in ?? raw.expiresIn, 'expires_in'),
      interval: optionalNumber(raw.interval)
    };
  }

  async pollDeviceToken(
    request: GatewayOAuthHttpDeviceTokenRequest
  ): Promise<GatewayOAuthHttpTokenResponse | GatewayOAuthHttpPendingDeviceResponse> {
    const body = formBody({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: request.clientId,
      client_secret: request.clientSecret,
      device_code: request.deviceCode,
      scope: request.scopes.join(' ')
    });
    const raw = asRecord(await this.postForm(request.tokenUrl, body));
    if (raw.error === 'authorization_pending' || raw.error === 'slow_down') {
      return { error: raw.error, interval: optionalNumber(raw.interval) };
    }
    return normalizeTokenResponse(raw);
  }

  private async postForm(url: string, body: string): Promise<unknown> {
    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(`Gateway OAuth HTTP request failed: ${response.status ?? 'unknown'}`);
    return payload;
  }
}

const fetchOAuth: GatewayOAuthFetch = async (url, init) => {
  const response = await fetch(url, init);
  return {
    ok: response.ok,
    status: response.status,
    json: () => response.json()
  };
};

function normalizeTokenResponse(value: unknown): GatewayOAuthHttpTokenResponse {
  const raw = asRecord(value);
  return {
    accessToken: stringValue(raw.access_token ?? raw.accessToken, 'access_token'),
    refreshToken: optionalString(raw.refresh_token ?? raw.refreshToken),
    tokenType: optionalString(raw.token_type ?? raw.tokenType),
    expiresIn: optionalNumber(raw.expires_in ?? raw.expiresIn),
    scope: optionalString(raw.scope),
    accountEmail: optionalString(raw.account_email ?? raw.accountEmail),
    projectId: optionalString(raw.project_id ?? raw.projectId)
  };
}

function formBody(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') params.set(key, value);
  }
  return params.toString();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Gateway OAuth response is invalid');
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Gateway OAuth response missing ${field}`);
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Gateway OAuth response missing ${field}`);
  return value;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
