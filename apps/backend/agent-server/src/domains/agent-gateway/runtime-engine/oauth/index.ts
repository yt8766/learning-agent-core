import { createAntigravityOAuthProvider } from './antigravity-oauth.provider';
import { createClaudeOAuthProvider } from './claude-oauth.provider';
import { createCodexOAuthProvider } from './codex-oauth.provider';
import { ConfigurableGatewayOAuthProvider, type GatewayOAuthProviderConfig } from './configurable-oauth-provider';
import { createGeminiCliOAuthProvider } from './gemini-cli-oauth.provider';
import { createKimiOAuthProvider } from './kimi-oauth.provider';
import type { GatewayOAuthHttpClient } from './gateway-oauth-http-client';
import type { GatewayOAuthProvider } from './gateway-oauth-provider';

export type {
  GatewayOAuthCredentialProjection,
  GatewayOAuthFlowStatus,
  GatewayOAuthProvider,
  GatewayOAuthProviderCallbackRequest,
  GatewayOAuthProviderPollResult,
  GatewayOAuthProviderStartRequest,
  GatewayOAuthProviderStartResult
} from './gateway-oauth-provider';
export type {
  GatewayOAuthHttpClient,
  GatewayOAuthHttpDeviceStartRequest,
  GatewayOAuthHttpDeviceTokenRequest,
  GatewayOAuthHttpExchangeRequest,
  GatewayOAuthHttpTokenResponse
} from './gateway-oauth-http-client';
export { FetchGatewayOAuthHttpClient } from './gateway-oauth-http-client';
export { ConfigurableGatewayOAuthProvider };
export type { GatewayOAuthProviderConfig } from './configurable-oauth-provider';

export interface GatewayOAuthProviderFactoryOptions {
  now?: () => Date;
  publicBaseUrl?: string;
  httpClient?: GatewayOAuthHttpClient;
  providerConfigs?: Partial<Record<string, GatewayOAuthProviderConfig>>;
}

export const AGENT_GATEWAY_OAUTH_PROVIDERS = Symbol('AGENT_GATEWAY_OAUTH_PROVIDERS');

export function createDefaultGatewayOAuthProviders(
  options: GatewayOAuthProviderFactoryOptions = {}
): GatewayOAuthProvider[] {
  const now = options.now ?? (() => new Date());
  return [
    configuredProvider('codex', options, now) ?? createCodexOAuthProvider(now),
    configuredProvider('claude', options, now) ?? createClaudeOAuthProvider(now),
    configuredProvider('gemini-cli', options, now) ?? createGeminiCliOAuthProvider(now),
    configuredProvider('antigravity', options, now) ?? createAntigravityOAuthProvider(now),
    configuredProvider('kimi', options, now) ?? createKimiOAuthProvider(now)
  ];
}

function configuredProvider(
  providerId: string,
  options: GatewayOAuthProviderFactoryOptions,
  now: () => Date
): GatewayOAuthProvider | null {
  const config = options.providerConfigs?.[providerId];
  if (!config || !options.httpClient) return null;
  return new ConfigurableGatewayOAuthProvider({
    providerId,
    config: { ...config, publicBaseUrl: config.publicBaseUrl ?? options.publicBaseUrl },
    httpClient: options.httpClient,
    now
  });
}
