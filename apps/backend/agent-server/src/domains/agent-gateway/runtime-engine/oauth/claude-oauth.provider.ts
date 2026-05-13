import { DeterministicGatewayOAuthProvider } from './deterministic-oauth-provider';
import { buildProviderNativeOAuthAuthorizationUri } from './provider-native-oauth-url';

export function createClaudeOAuthProvider(now: () => Date) {
  return new DeterministicGatewayOAuthProvider({
    providerId: 'claude',
    buildAuthorizationUri: state => buildProviderNativeOAuthAuthorizationUri({ provider: 'claude', state }),
    scopes: ['user:profile', 'user:inference', 'user:sessions:claude_code', 'user:mcp_servers', 'user:file_upload'],
    now
  });
}
