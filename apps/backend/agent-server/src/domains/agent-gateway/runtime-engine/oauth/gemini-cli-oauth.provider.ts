import { DeterministicGatewayOAuthProvider } from './deterministic-oauth-provider';

export function createGeminiCliOAuthProvider(now: () => Date) {
  return new DeterministicGatewayOAuthProvider({
    providerId: 'gemini-cli',
    authorizationBaseUrl: 'https://auth.gemini-cli.local/oauth/authorize',
    scopes: ['openid', 'profile', 'offline_access', 'gemini.gateway'],
    now
  });
}
