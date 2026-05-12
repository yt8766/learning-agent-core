import type {
  GatewayOAuthCredentialProjection,
  GatewayOAuthFlowStatus,
  GatewayOAuthProvider,
  GatewayOAuthProviderCallbackRequest,
  GatewayOAuthProviderStartRequest,
  GatewayOAuthProviderStartResult
} from './gateway-oauth-provider';

export interface DeterministicOAuthProviderOptions {
  providerId: string;
  authorizationBaseUrl?: string;
  deviceVerificationUri?: string;
  deviceCodePrefix?: string;
  buildAuthorizationUri?: (state: string) => string;
  scopes: string[];
  now: () => Date;
}

export class DeterministicGatewayOAuthProvider implements GatewayOAuthProvider {
  readonly providerId: string;

  constructor(private readonly options: DeterministicOAuthProviderOptions) {
    this.providerId = options.providerId;
  }

  start(request: GatewayOAuthProviderStartRequest): GatewayOAuthProviderStartResult {
    const flowId = flowIdFor(request.providerId, request.credentialFileId);
    const expiresAt = new Date(this.options.now().getTime() + 15 * 60 * 1000).toISOString();
    return {
      flowId,
      providerId: request.providerId,
      credentialFileId: request.credentialFileId,
      verificationUri: this.verificationUri(flowId),
      userCode: this.userCode(request.credentialFileId),
      expiresAt
    };
  }

  completeCallback(request: GatewayOAuthProviderCallbackRequest): GatewayOAuthCredentialProjection {
    const credentialFileId = credentialFileIdFromState(request.state, request.providerId);
    const completedAt = this.options.now().toISOString();
    const secretRef = `vault://agent-gateway/oauth/${credentialFileId}`;
    if (request.error) {
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
    const code = request.code ?? 'device-flow-complete';
    return {
      credentialId: `${request.providerId}:${credentialFileId}`,
      providerId: request.providerId,
      credentialFileId,
      accountEmail: `${request.providerId}@agent-gateway.local`,
      projectId: `${request.providerId}-project`,
      scopes: [...this.options.scopes],
      expiresAt: new Date(this.options.now().getTime() + 60 * 60 * 1000).toISOString(),
      secretRef,
      secretPayload: {
        access_token: `${request.providerId}-access-${code}`,
        refresh_token: `${request.providerId}-refresh-${code}`,
        token_type: 'Bearer',
        redirect_url: request.redirectUrl
      },
      completedAt,
      status: 'valid'
    };
  }

  pollStatus(state: GatewayOAuthProviderStartResult, now: Date): GatewayOAuthFlowStatus {
    return Date.parse(state.expiresAt) < now.getTime() ? 'expired' : 'pending';
  }

  async refreshCredential(credentialId: string): Promise<GatewayOAuthCredentialProjection> {
    const [, credentialFileId = credentialId] = credentialId.split(':');
    return this.completeCallback({
      providerId: this.providerId,
      state: flowIdFor(this.providerId, credentialFileId),
      code: 'refresh'
    });
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

  private verificationUri(flowId: string): string {
    if (this.options.deviceVerificationUri) return this.options.deviceVerificationUri;
    if (this.options.buildAuthorizationUri) return this.options.buildAuthorizationUri(flowId);
    const baseUrl = this.options.authorizationBaseUrl ?? `https://auth.${this.providerId}.local/oauth/authorize`;
    const url = new URL(baseUrl);
    url.searchParams.set('state', flowId);
    return url.toString();
  }

  private userCode(credentialFileId: string): string {
    return `${this.options.deviceCodePrefix ?? 'CODE'}-${this.providerId === 'kimi' ? credentialFileId : `${this.providerId}-${credentialFileId}`}`;
  }
}

export function flowIdFor(providerId: string, credentialFileId: string): string {
  return `oauth-${providerId}-${credentialFileId}`;
}

function credentialFileIdFromState(state: string, providerId: string): string {
  const prefix = `oauth-${providerId}-`;
  return state.startsWith(prefix) ? state.slice(prefix.length) : state;
}
