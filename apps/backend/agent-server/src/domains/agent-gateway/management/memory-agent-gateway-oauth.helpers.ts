import type { GatewayGeminiCliOAuthStartRequest, GatewayProviderOAuthStartRequest } from '@agent/core';
import { buildProviderNativeOAuthAuthorizationUri } from '../runtime-engine/oauth/provider-native-oauth-url';
import type { GatewayStartOAuthProjection } from './agent-gateway-management-client';

const memoryOAuthExpiresAt = '2026-05-08T00:15:00.000Z';

export function startMemoryProviderOAuth(request: GatewayProviderOAuthStartRequest): GatewayStartOAuthProjection {
  if (request.provider === 'kimi') {
    return {
      state: 'kimi-device',
      verificationUri: 'https://www.kimi.com/code/authorize_device?user_code=MEMO-RYKI',
      userCode: 'MEMO-RYKI',
      expiresAt: memoryOAuthExpiresAt,
      projectId: request.projectId
    };
  }

  const state = `${request.provider}-state`;
  return {
    state,
    verificationUri: buildProviderNativeOAuthAuthorizationUri({
      provider: providerNativeOAuthName(request.provider),
      state
    }),
    userCode: `MEMORY-${request.provider.toUpperCase()}`,
    expiresAt: memoryOAuthExpiresAt,
    projectId: request.projectId
  };
}

export function startMemoryGeminiCliOAuth(request: GatewayGeminiCliOAuthStartRequest): GatewayStartOAuthProjection {
  return {
    state: `gemini-cli-${request.projectId ?? 'default'}`,
    verificationUri: 'https://accounts.google.com/o/oauth2/v2/auth',
    userCode: 'MEMORY-GEMINI',
    expiresAt: memoryOAuthExpiresAt,
    projectId: request.projectId
  };
}

function providerNativeOAuthName(provider: string): string {
  return provider === 'anthropic' ? 'claude' : provider;
}
