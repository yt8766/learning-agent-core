import type {
  GatewayOAuthCredentialProjection,
  GatewayOAuthProvider,
  GatewayOAuthProviderCallbackRequest,
  GatewayOAuthProviderFlow,
  GatewayOAuthProviderPollResult,
  GatewayOAuthProviderStartRequest,
  GatewayOAuthProviderStartResult
} from './gateway-oauth-provider';
import { flowIdFor } from './deterministic-oauth-provider';
import type { GatewayOAuthHttpClient, GatewayOAuthHttpTokenResponse } from './gateway-oauth-http-client';

export interface GatewayOAuthProviderConfig {
  clientId: string;
  clientSecret?: string;
  authUrl?: string;
  tokenUrl: string;
  deviceUrl?: string;
  scopes: string[];
  publicBaseUrl?: string;
  flow?: GatewayOAuthProviderFlow;
}

export interface ConfigurableGatewayOAuthProviderOptions {
  providerId: string;
  config: GatewayOAuthProviderConfig;
  httpClient: GatewayOAuthHttpClient;
  now: () => Date;
}

export class ConfigurableGatewayOAuthProvider implements GatewayOAuthProvider {
  readonly providerId: string;

  constructor(private readonly options: ConfigurableGatewayOAuthProviderOptions) {
    this.providerId = options.providerId;
  }

  async start(request: GatewayOAuthProviderStartRequest): Promise<GatewayOAuthProviderStartResult> {
    const flowId = flowIdFor(request.providerId, request.credentialFileId);
    if (this.flow() === 'device') {
      const response = await this.options.httpClient.startDeviceAuthorization({
        providerId: this.providerId,
        deviceUrl: required(this.options.config.deviceUrl, `${this.providerId} OAuth deviceUrl is required`),
        clientId: this.options.config.clientId,
        clientSecret: this.options.config.clientSecret,
        scopes: this.options.config.scopes
      });
      return {
        flowId,
        providerId: request.providerId,
        credentialFileId: request.credentialFileId,
        verificationUri: response.verificationUri,
        userCode: response.userCode,
        expiresAt: new Date(this.options.now().getTime() + response.expiresIn * 1000).toISOString(),
        internal: {
          deviceCode: response.deviceCode,
          intervalSeconds: response.interval
        }
      };
    }

    const redirectUri = callbackRedirectUri(this.options.config.publicBaseUrl);
    const url = new URL(required(this.options.config.authUrl, `${this.providerId} OAuth authUrl is required`));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.options.config.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', this.options.config.scopes.join(' '));
    url.searchParams.set('state', flowId);
    return {
      flowId,
      providerId: request.providerId,
      credentialFileId: request.credentialFileId,
      verificationUri: url.toString(),
      userCode: '',
      expiresAt: new Date(this.options.now().getTime() + 15 * 60 * 1000).toISOString(),
      internal: { redirectUri }
    };
  }

  async completeCallback(request: GatewayOAuthProviderCallbackRequest): Promise<GatewayOAuthCredentialProjection> {
    const credentialFileId = credentialFileIdFromState(request.state, request.providerId);
    const completedAt = this.options.now().toISOString();
    const secretRef = secretRefFor(credentialFileId);
    if (request.error) return errorCredential(request, credentialFileId, completedAt, secretRef);

    const code = required(request.code, `${this.providerId} OAuth callback code is required`);
    const response = await this.options.httpClient.exchangeAuthorizationCode({
      providerId: this.providerId,
      tokenUrl: this.options.config.tokenUrl,
      clientId: this.options.config.clientId,
      clientSecret: this.options.config.clientSecret,
      code,
      redirectUri: callbackRedirectUri(this.options.config.publicBaseUrl),
      scopes: this.options.config.scopes
    });
    return this.projectCredential(credentialFileId, response, completedAt, secretRef);
  }

  async pollStatus(state: GatewayOAuthProviderStartResult, now: Date): Promise<GatewayOAuthProviderPollResult> {
    if (Date.parse(state.expiresAt) < now.getTime()) return { status: 'expired' };
    if (this.flow() !== 'device') return { status: 'pending' };

    const response = await this.options.httpClient.pollDeviceToken({
      providerId: this.providerId,
      tokenUrl: this.options.config.tokenUrl,
      clientId: this.options.config.clientId,
      clientSecret: this.options.config.clientSecret,
      deviceCode: required(state.internal?.deviceCode, `${this.providerId} OAuth deviceCode is missing`),
      scopes: this.options.config.scopes
    });
    if ('error' in response) return { status: 'pending' };

    const credential = this.projectCredential(
      state.credentialFileId,
      response,
      this.options.now().toISOString(),
      secretRefFor(state.credentialFileId)
    );
    return { status: 'completed', credential };
  }

  async refreshCredential(credentialId: string): Promise<GatewayOAuthCredentialProjection> {
    throw new Error(`Gateway OAuth refresh is not implemented for ${credentialId}`);
  }

  projectAuthFile(credential: GatewayOAuthCredentialProjection) {
    return {
      id: credential.credentialFileId,
      provider: credential.providerId,
      path: `/agent-gateway/auth-files/${credential.credentialFileId}`,
      status: credential.status === 'valid' ? 'valid' : 'missing',
      lastCheckedAt: credential.completedAt
    } as const;
  }

  private flow(): GatewayOAuthProviderFlow {
    return (
      this.options.config.flow ??
      (this.options.config.deviceUrl && !this.options.config.authUrl ? 'device' : 'authorization_code')
    );
  }

  private projectCredential(
    credentialFileId: string,
    response: GatewayOAuthHttpTokenResponse,
    completedAt: string,
    secretRef: string
  ): GatewayOAuthCredentialProjection {
    return {
      credentialId: `${this.providerId}:${credentialFileId}`,
      providerId: this.providerId,
      credentialFileId,
      accountEmail: response.accountEmail ?? null,
      projectId: response.projectId ?? null,
      scopes: scopesFromToken(response.scope, this.options.config.scopes),
      expiresAt: response.expiresIn
        ? new Date(this.options.now().getTime() + response.expiresIn * 1000).toISOString()
        : null,
      secretRef,
      secretPayload: {
        access_token: response.accessToken,
        refresh_token: response.refreshToken,
        token_type: response.tokenType ?? 'Bearer',
        scope: response.scope
      },
      completedAt,
      status: 'valid'
    };
  }
}

function callbackRedirectUri(publicBaseUrl?: string): string {
  const baseUrl = required(publicBaseUrl, 'OAuth publicBaseUrl is required for callback flow').replace(/\/+$/, '');
  return `${baseUrl}/api/agent-gateway/oauth/callback`;
}

function credentialFileIdFromState(state: string, providerId: string): string {
  const prefix = `oauth-${providerId}-`;
  return state.startsWith(prefix) ? state.slice(prefix.length) : state;
}

function errorCredential(
  request: GatewayOAuthProviderCallbackRequest,
  credentialFileId: string,
  completedAt: string,
  secretRef: string
): GatewayOAuthCredentialProjection {
  return {
    credentialId: `${request.providerId}:${credentialFileId}`,
    providerId: request.providerId,
    credentialFileId,
    accountEmail: null,
    projectId: null,
    scopes: [],
    expiresAt: null,
    secretRef,
    secretPayload: { error: request.error, redirect_url: request.redirectUrl },
    completedAt,
    status: 'error',
    error: request.error
  };
}

function scopesFromToken(scope: string | undefined, fallback: string[]): string[] {
  return scope ? scope.split(/\s+/).filter(Boolean) : [...fallback];
}

function secretRefFor(credentialFileId: string): string {
  return `vault://agent-gateway/oauth/${credentialFileId}`;
}

function required<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined || value === '') throw new Error(message);
  return value;
}
