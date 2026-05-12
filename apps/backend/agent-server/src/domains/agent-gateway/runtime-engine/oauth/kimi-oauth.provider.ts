import { DeterministicGatewayOAuthProvider } from './deterministic-oauth-provider';

export function createKimiOAuthProvider(now: () => Date) {
  return new DeterministicGatewayOAuthProvider({
    providerId: 'kimi',
    deviceVerificationUri: 'https://kimi.local/device',
    deviceCodePrefix: 'KIMI',
    scopes: ['openid', 'profile', 'offline_access', 'kimi.gateway'],
    now
  });
}
