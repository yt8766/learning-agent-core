import type { GatewayCredentialFile } from '@agent/core';

export type GatewayOAuthFlowStatus = 'pending' | 'completed' | 'expired' | 'error';
export type GatewayOAuthProviderFlow = 'authorization_code' | 'device';
export type MaybePromise<T> = T | Promise<T>;

export interface GatewayOAuthProviderStartRequest {
  providerId: string;
  credentialFileId: string;
}

export interface GatewayOAuthProviderStartResult {
  flowId: string;
  providerId: string;
  credentialFileId: string;
  verificationUri: string;
  userCode: string;
  expiresAt: string;
  internal?: GatewayOAuthProviderFlowState;
}

export interface GatewayOAuthProviderFlowState {
  deviceCode?: string;
  redirectUri?: string;
  intervalSeconds?: number;
}

export interface GatewayOAuthProviderCallbackRequest {
  providerId: string;
  state: string;
  code?: string;
  error?: string;
  redirectUrl?: string;
}

export interface GatewayOAuthCredentialProjection {
  credentialId: string;
  providerId: string;
  credentialFileId: string;
  accountEmail: string | null;
  projectId: string | null;
  scopes: string[];
  expiresAt: string | null;
  secretRef: string;
  secretPayload: Record<string, unknown>;
  completedAt: string;
  status: 'valid' | 'error';
  error?: string;
}

export interface GatewayOAuthProviderPollResult {
  status: GatewayOAuthFlowStatus;
  credential?: GatewayOAuthCredentialProjection;
  error?: string;
}

export interface GatewayOAuthProvider {
  readonly providerId: string;
  start(request: GatewayOAuthProviderStartRequest): MaybePromise<GatewayOAuthProviderStartResult>;
  completeCallback(request: GatewayOAuthProviderCallbackRequest): MaybePromise<GatewayOAuthCredentialProjection>;
  pollStatus(
    state: GatewayOAuthProviderStartResult,
    now: Date
  ): MaybePromise<GatewayOAuthFlowStatus | GatewayOAuthProviderPollResult>;
  refreshCredential(credentialId: string): Promise<GatewayOAuthCredentialProjection>;
  projectAuthFile(credential: GatewayOAuthCredentialProjection): GatewayCredentialFile;
}
