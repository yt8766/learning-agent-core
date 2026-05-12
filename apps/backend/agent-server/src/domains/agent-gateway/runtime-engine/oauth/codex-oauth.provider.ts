import { DeterministicGatewayOAuthProvider } from './deterministic-oauth-provider';
import { buildProviderNativeOAuthAuthorizationUri } from './provider-native-oauth-url';

export function createCodexOAuthProvider(now: () => Date) {
  return new DeterministicGatewayOAuthProvider({
    providerId: 'codex',
    buildAuthorizationUri: state => buildProviderNativeOAuthAuthorizationUri({ provider: 'codex', state }),
    scopes: ['openid', 'email', 'profile', 'offline_access'],
    now
  });
}
