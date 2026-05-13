export type ProviderNativeOAuthProvider = 'antigravity' | 'claude' | 'codex';

export interface ProviderNativeOAuthUrlInput {
  provider: string;
  state: string;
}

export function buildProviderNativeOAuthAuthorizationUri(input: ProviderNativeOAuthUrlInput): string {
  switch (input.provider) {
    case 'codex':
      return buildUrl('https://auth.openai.com/oauth/authorize', {
        client_id: 'app_EMoamEEZ73f0CkXaXp7hrann',
        code_challenge: '81YhU6s9ifKKqpzWT-xsu7n_r2hNny2Y3cpnZ8_4ess',
        code_challenge_method: 'S256',
        codex_cli_simplified_flow: 'true',
        id_token_add_organizations: 'true',
        prompt: 'login',
        redirect_uri: 'http://localhost:1455/auth/callback',
        response_type: 'code',
        scope: 'openid email profile offline_access',
        state: input.state
      });
    case 'claude':
      return buildUrl('https://claude.ai/oauth/authorize', {
        client_id: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
        code: 'true',
        code_challenge: 'ycGk8VhUw1uqFCYOawHkioqtIyqSU0THyFWEj-Mcc3c',
        code_challenge_method: 'S256',
        redirect_uri: 'http://localhost:54545/callback',
        response_type: 'code',
        scope: 'user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload',
        state: input.state
      });
    case 'antigravity':
      return buildUrl('https://accounts.google.com/o/oauth2/v2/auth', {
        access_type: 'offline',
        client_id: '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
        prompt: 'consent',
        redirect_uri: 'http://localhost:51121/oauth-callback',
        response_type: 'code',
        scope:
          'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/cclog https://www.googleapis.com/auth/experimentsandconfigs',
        state: input.state
      });
    default:
      throw new Error(`Provider-native OAuth authorization URL is not configured for ${input.provider}`);
  }
}

function buildUrl(baseUrl: string, params: Record<string, string>): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
