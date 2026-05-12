import { describe, expect, it } from 'vitest';
import { FetchGatewayOAuthHttpClient } from '../../src/domains/agent-gateway/runtime-engine/oauth';

describe('FetchGatewayOAuthHttpClient', () => {
  it('normalizes token exchange and device polling through the project OAuth HTTP client boundary', async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const client = new FetchGatewayOAuthHttpClient(async (url, init) => {
      calls.push({ url: String(url), body: String(init.body) });
      return {
        ok: true,
        async json() {
          if (String(url).includes('/device/code')) {
            return {
              device_code: 'device-code-1',
              user_code: 'USER-1',
              verification_uri: 'https://provider.example/device',
              expires_in: 900,
              interval: 5
            };
          }
          return {
            access_token: 'access-1',
            refresh_token: 'refresh-1',
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'openid profile',
            account_email: 'user@example.com',
            project_id: 'project-1'
          };
        }
      };
    });

    await expect(
      client.exchangeAuthorizationCode({
        providerId: 'codex',
        tokenUrl: 'https://provider.example/token',
        clientId: 'client-1',
        clientSecret: 'secret-1',
        code: 'code-1',
        redirectUri: 'https://gateway.example.com/api/agent-gateway/oauth/callback',
        scopes: ['openid', 'profile']
      })
    ).resolves.toMatchObject({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      accountEmail: 'user@example.com',
      projectId: 'project-1'
    });
    await expect(
      client.startDeviceAuthorization({
        providerId: 'kimi',
        deviceUrl: 'https://provider.example/device/code',
        clientId: 'client-1',
        scopes: ['openid', 'profile']
      })
    ).resolves.toMatchObject({
      deviceCode: 'device-code-1',
      userCode: 'USER-1',
      verificationUri: 'https://provider.example/device'
    });
    await expect(
      client.pollDeviceToken({
        providerId: 'kimi',
        tokenUrl: 'https://provider.example/token',
        clientId: 'client-1',
        deviceCode: 'device-code-1',
        scopes: ['openid', 'profile']
      })
    ).resolves.toMatchObject({ accessToken: 'access-1' });

    expect(calls.map(call => call.url)).toEqual([
      'https://provider.example/token',
      'https://provider.example/device/code',
      'https://provider.example/token'
    ]);
    expect(calls[0]?.body).toContain('grant_type=authorization_code');
    expect(calls[0]?.body).toContain('client_secret=secret-1');
    expect(calls[1]?.body).toContain('scope=openid+profile');
    expect(calls[2]?.body).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code');
  });
});
