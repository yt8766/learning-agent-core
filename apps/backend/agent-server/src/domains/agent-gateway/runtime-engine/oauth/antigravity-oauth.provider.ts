import { DeterministicGatewayOAuthProvider } from './deterministic-oauth-provider';
import { buildProviderNativeOAuthAuthorizationUri } from './provider-native-oauth-url';

export function createAntigravityOAuthProvider(now: () => Date) {
  return new DeterministicGatewayOAuthProvider({
    providerId: 'antigravity',
    buildAuthorizationUri: state => buildProviderNativeOAuthAuthorizationUri({ provider: 'antigravity', state }),
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/cclog',
      'https://www.googleapis.com/auth/experimentsandconfigs'
    ],
    now
  });
}
