import { Inject, Injectable } from '@nestjs/common';
import type {
  GatewayOAuthModelAliasListResponse,
  GatewayProviderOAuthStartRequest,
  GatewayProviderOAuthStartResponse,
  GatewayUpdateOAuthModelAliasRulesRequest,
  GatewayVertexCredentialImportRequest,
  GatewayVertexCredentialImportResponse
} from '@agent/core';
import {
  GatewayOAuthCallbackResponseSchema,
  GatewayOAuthModelAliasListResponseSchema,
  GatewayOAuthStatusResponseSchema,
  GatewayProviderOAuthStartProviderSchema,
  GatewayProviderOAuthStartResponseSchema,
  GatewayVertexCredentialImportResponseSchema
} from '@agent/core';
import type { AgentGatewayManagementClient } from '../management/agent-gateway-management-client';
import type { GatewayStartOAuthProjection } from '../management/agent-gateway-management-client';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';
import { buildProviderNativeOAuthAuthorizationUri } from '../runtime-engine/oauth/provider-native-oauth-url';

export interface GatewayOAuthStatusResponse {
  state: string;
  status: 'pending' | 'completed' | 'expired' | 'error';
  checkedAt: string;
}

export interface GatewayOAuthCallbackRequest {
  provider: string;
  redirectUrl: string;
}

export interface GatewayOAuthCallbackResponse {
  accepted: boolean;
  provider: string;
  completedAt: string;
}

export interface GatewayGeminiCliOAuthStartRequest {
  projectId?: string;
}

export interface GatewayGeminiCliOAuthStartResponse {
  state: string;
  verificationUri: string;
  expiresAt: string;
}

export type GatewayVertexCredentialImportFacadeResponse = GatewayVertexCredentialImportResponse & {
  imported: boolean;
};

interface OAuthPolicyManagementClient {
  listOAuthModelAliases?(providerId: string): Promise<GatewayOAuthModelAliasListResponse>;
  saveOAuthModelAliases?(
    request: GatewayUpdateOAuthModelAliasRulesRequest
  ): Promise<GatewayOAuthModelAliasListResponse>;
  getOAuthStatus?(state: string): Promise<GatewayOAuthStatusResponse>;
  submitOAuthCallback?(request: GatewayOAuthCallbackRequest): Promise<GatewayOAuthCallbackResponse>;
  startProviderOAuth?(request: GatewayProviderOAuthStartRequest): Promise<GatewayStartOAuthProjection>;
  startGeminiCliOAuth?(request: GatewayGeminiCliOAuthStartRequest): Promise<GatewayStartOAuthProjection>;
  importVertexCredential?(
    request: GatewayVertexCredentialImportRequest
  ): Promise<GatewayVertexCredentialImportFacadeResponse>;
}

const fixedNow = '2026-05-09T00:00:00.000Z';

@Injectable()
export class AgentGatewayOAuthPolicyService {
  private readonly aliases = new Map<string, GatewayOAuthModelAliasListResponse>();

  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  async listAliases(providerId: string): Promise<GatewayOAuthModelAliasListResponse> {
    const delegate = this.delegate();
    if (delegate.listOAuthModelAliases) {
      return GatewayOAuthModelAliasListResponseSchema.parse(await delegate.listOAuthModelAliases(providerId));
    }
    return GatewayOAuthModelAliasListResponseSchema.parse(
      cloneAliasList(this.aliases.get(providerId) ?? { providerId, modelAliases: [], updatedAt: fixedNow })
    );
  }

  async saveAliases(request: GatewayUpdateOAuthModelAliasRulesRequest): Promise<GatewayOAuthModelAliasListResponse> {
    const delegate = this.delegate();
    if (delegate.saveOAuthModelAliases) {
      return GatewayOAuthModelAliasListResponseSchema.parse(await delegate.saveOAuthModelAliases(request));
    }
    const response = {
      providerId: request.providerId,
      modelAliases: request.modelAliases.map(alias => ({ ...alias })),
      updatedAt: fixedNow
    };
    this.aliases.set(request.providerId, response);
    return GatewayOAuthModelAliasListResponseSchema.parse(cloneAliasList(response));
  }

  async status(state: string): Promise<GatewayOAuthStatusResponse> {
    const delegate = this.delegate();
    if (delegate.getOAuthStatus) return GatewayOAuthStatusResponseSchema.parse(await delegate.getOAuthStatus(state));
    return GatewayOAuthStatusResponseSchema.parse({ state, status: 'pending', checkedAt: fixedNow });
  }

  async submitCallback(request: GatewayOAuthCallbackRequest): Promise<GatewayOAuthCallbackResponse> {
    const delegate = this.delegate();
    if (delegate.submitOAuthCallback) {
      return GatewayOAuthCallbackResponseSchema.parse(await delegate.submitOAuthCallback(request));
    }
    return GatewayOAuthCallbackResponseSchema.parse({
      accepted: true,
      provider: request.provider,
      completedAt: fixedNow
    });
  }

  async startProviderAuth(request: GatewayProviderOAuthStartRequest): Promise<GatewayProviderOAuthStartResponse> {
    const delegate = this.delegate();
    if (delegate.startProviderOAuth) {
      const projection = await delegate.startProviderOAuth(request);
      return GatewayProviderOAuthStartResponseSchema.parse({
        state: projection.state,
        verificationUri: normalizeOAuthAuthorizationUri(request.provider, projection.state, projection.verificationUri),
        userCode: projection.userCode,
        expiresAt: projection.expiresAt ?? '2026-05-09T00:10:00.000Z'
      });
    }
    const state = `${request.provider}-state`;
    return GatewayProviderOAuthStartResponseSchema.parse({
      state,
      verificationUri: buildProviderNativeOAuthAuthorizationUri({
        provider: providerNativeOAuthName(request.provider),
        state
      }),
      userCode: `CODE-${request.provider}`,
      expiresAt: '2026-05-09T00:10:00.000Z'
    });
  }

  startProviderOAuth(
    providerId: string,
    request: Partial<GatewayProviderOAuthStartRequest> = {}
  ): Promise<GatewayProviderOAuthStartResponse> {
    return this.startProviderAuth({
      ...request,
      provider: GatewayProviderOAuthStartProviderSchema.parse(providerId)
    });
  }

  async startGeminiCli(request: GatewayGeminiCliOAuthStartRequest): Promise<GatewayGeminiCliOAuthStartResponse> {
    const delegate = this.delegate();
    if (delegate.startGeminiCliOAuth) {
      const projection = await delegate.startGeminiCliOAuth(request);
      return {
        state: `gemini-cli-${projection.projectId ?? request.projectId ?? 'default'}`,
        verificationUri: projection.verificationUri,
        expiresAt: projection.expiresAt ?? '2026-05-09T00:10:00.000Z'
      };
    }
    const projectId = request.projectId ?? 'default';
    return {
      state: `gemini-cli-${projectId}`,
      verificationUri: `https://accounts.google.com/o/oauth2/v2/auth?project_id=${encodeURIComponent(projectId)}`,
      expiresAt: '2026-05-09T00:10:00.000Z'
    };
  }

  async importVertexCredential(
    request: GatewayVertexCredentialImportRequest
  ): Promise<GatewayVertexCredentialImportFacadeResponse> {
    const delegate = this.delegate();
    if (delegate.importVertexCredential) {
      const parsed = GatewayVertexCredentialImportResponseSchema.parse(await delegate.importVertexCredential(request));
      return { ...parsed, imported: parsed.imported ?? false };
    }
    const parsed = GatewayVertexCredentialImportResponseSchema.parse({
      status: 'ok',
      imported: true,
      location: request.location,
      authFile: request.fileName,
      authFileId: request.fileName
    });
    return { ...parsed, imported: parsed.imported ?? true };
  }

  private delegate(): OAuthPolicyManagementClient {
    return this.managementClient as unknown as OAuthPolicyManagementClient;
  }
}

function providerNativeOAuthName(provider: string): string {
  return provider === 'anthropic' ? 'claude' : provider;
}

function cloneAliasList(record: GatewayOAuthModelAliasListResponse): GatewayOAuthModelAliasListResponse {
  return {
    providerId: record.providerId,
    modelAliases: record.modelAliases.map(alias => ({ ...alias })),
    updatedAt: record.updatedAt
  };
}

function normalizeOAuthAuthorizationUri(provider: string, state: string, verificationUri: string): string {
  if (!isAgentGatewayCallbackPlaceholder(verificationUri)) return verificationUri;
  return buildProviderNativeOAuthAuthorizationUri({
    provider: providerNativeOAuthName(provider),
    state
  });
}

function isAgentGatewayCallbackPlaceholder(value: string): boolean {
  const candidates = collectUriCandidates(value);
  return candidates.some(candidate => {
    try {
      return new URL(candidate, 'http://localhost').pathname.replace(/\/$/, '') === '/api/agent-gateway/oauth/callback';
    } catch {
      return false;
    }
  });
}

function collectUriCandidates(value: string): string[] {
  const candidates = [value];
  try {
    const decoded = decodeURIComponent(value);
    if (decoded !== value) candidates.push(decoded);
  } catch {
    // ignore non-decodable values
  }
  return Array.from(new Set(candidates));
}
