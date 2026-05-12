import { describe, expect, it, vi } from 'vitest';

import { FetchGatewayOAuthHttpClient } from '../../src/domains/agent-gateway/runtime-engine/oauth/gateway-oauth-http-client';

function makeMockFetch(responseData: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({
    ok,
    status,
    json: async () => responseData
  }));
}

describe('FetchGatewayOAuthHttpClient', () => {
  describe('exchangeAuthorizationCode', () => {
    it('exchanges code for tokens', async () => {
      const mockFetch = makeMockFetch({
        access_token: 'at-123',
        refresh_token: 'rt-456',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read write',
        account_email: 'user@example.com',
        project_id: 'proj-1'
      });
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      const result = await client.exchangeAuthorizationCode({
        providerId: 'gemini',
        tokenUrl: 'https://oauth.example.com/token',
        clientId: 'client-1',
        clientSecret: 'secret-1',
        code: 'auth-code',
        redirectUri: 'https://app.example.com/callback',
        scopes: ['read', 'write']
      });
      expect(result.accessToken).toBe('at-123');
      expect(result.refreshToken).toBe('rt-456');
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(3600);
      expect(result.scope).toBe('read write');
      expect(result.accountEmail).toBe('user@example.com');
      expect(result.projectId).toBe('proj-1');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('uses camelCase field names as fallback', async () => {
      const mockFetch = makeMockFetch({
        accessToken: 'at-camel',
        refreshToken: 'rt-camel',
        tokenType: 'Bearer',
        expiresIn: 600
      });
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      const result = await client.exchangeAuthorizationCode({
        providerId: 'gemini',
        tokenUrl: 'https://oauth.example.com/token',
        clientId: 'client-1',
        code: 'code',
        redirectUri: 'https://app.example.com/callback',
        scopes: ['read']
      });
      expect(result.accessToken).toBe('at-camel');
      expect(result.refreshToken).toBe('rt-camel');
    });

    it('throws on non-ok response', async () => {
      const mockFetch = makeMockFetch({ error: 'invalid_grant' }, false, 400);
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      await expect(
        client.exchangeAuthorizationCode({
          providerId: 'gemini',
          tokenUrl: 'https://oauth.example.com/token',
          clientId: 'client-1',
          code: 'bad-code',
          redirectUri: 'https://app.example.com/callback',
          scopes: ['read']
        })
      ).rejects.toThrow('400');
    });
  });

  describe('startDeviceAuthorization', () => {
    it('starts device flow', async () => {
      const mockFetch = makeMockFetch({
        device_code: 'dc-123',
        user_code: 'ABCD-1234',
        verification_uri: 'https://device.example.com',
        expires_in: 600,
        interval: 5
      });
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      const result = await client.startDeviceAuthorization({
        providerId: 'gemini',
        deviceUrl: 'https://oauth.example.com/device',
        clientId: 'client-1',
        scopes: ['read']
      });
      expect(result.deviceCode).toBe('dc-123');
      expect(result.userCode).toBe('ABCD-1234');
      expect(result.verificationUri).toBe('https://device.example.com');
      expect(result.expiresIn).toBe(600);
      expect(result.interval).toBe(5);
    });

    it('uses camelCase fallbacks', async () => {
      const mockFetch = makeMockFetch({
        deviceCode: 'dc-camel',
        userCode: 'UC-CAMEL',
        verificationUri: 'https://device.example.com',
        expiresIn: 300
      });
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      const result = await client.startDeviceAuthorization({
        providerId: 'gemini',
        deviceUrl: 'https://oauth.example.com/device',
        clientId: 'client-1',
        scopes: ['read']
      });
      expect(result.deviceCode).toBe('dc-camel');
      expect(result.userCode).toBe('UC-CAMEL');
    });

    it('uses verification_url fallback', async () => {
      const mockFetch = makeMockFetch({
        device_code: 'dc-1',
        user_code: 'UC-1',
        verification_url: 'https://device.example.com/old',
        expires_in: 600
      });
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      const result = await client.startDeviceAuthorization({
        providerId: 'gemini',
        deviceUrl: 'https://oauth.example.com/device',
        clientId: 'client-1',
        scopes: ['read']
      });
      expect(result.verificationUri).toBe('https://device.example.com/old');
    });

    it('throws on invalid response body', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => null
      }));
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      await expect(
        client.startDeviceAuthorization({
          providerId: 'gemini',
          deviceUrl: 'https://oauth.example.com/device',
          clientId: 'client-1',
          scopes: ['read']
        })
      ).rejects.toThrow('invalid');
    });

    it('throws on array response body', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [1, 2, 3]
      }));
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      await expect(
        client.startDeviceAuthorization({
          providerId: 'gemini',
          deviceUrl: 'https://oauth.example.com/device',
          clientId: 'client-1',
          scopes: ['read']
        })
      ).rejects.toThrow('invalid');
    });
  });

  describe('pollDeviceToken', () => {
    it('returns pending error', async () => {
      const mockFetch = makeMockFetch({
        error: 'authorization_pending',
        interval: 5
      });
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      const result = await client.pollDeviceToken({
        providerId: 'gemini',
        tokenUrl: 'https://oauth.example.com/token',
        clientId: 'client-1',
        deviceCode: 'dc-1',
        scopes: ['read']
      });
      expect(result).toEqual({ error: 'authorization_pending', interval: 5 });
    });

    it('returns slow_down error', async () => {
      const mockFetch = makeMockFetch({
        error: 'slow_down',
        interval: 10
      });
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      const result = await client.pollDeviceToken({
        providerId: 'gemini',
        tokenUrl: 'https://oauth.example.com/token',
        clientId: 'client-1',
        deviceCode: 'dc-1',
        scopes: ['read']
      });
      expect(result).toEqual({ error: 'slow_down', interval: 10 });
    });

    it('returns token response on success', async () => {
      const mockFetch = makeMockFetch({
        access_token: 'at-success',
        refresh_token: 'rt-success'
      });
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      const result = await client.pollDeviceToken({
        providerId: 'gemini',
        tokenUrl: 'https://oauth.example.com/token',
        clientId: 'client-1',
        deviceCode: 'dc-1',
        scopes: ['read']
      });
      expect(result).toHaveProperty('accessToken', 'at-success');
      expect(result).toHaveProperty('refreshToken', 'rt-success');
    });

    it('throws on non-ok response', async () => {
      const mockFetch = makeMockFetch({ error: 'expired_token' }, false, 401);
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      await expect(
        client.pollDeviceToken({
          providerId: 'gemini',
          tokenUrl: 'https://oauth.example.com/token',
          clientId: 'client-1',
          deviceCode: 'dc-1',
          scopes: ['read']
        })
      ).rejects.toThrow('401');
    });
  });

  describe('formBody', () => {
    it('excludes undefined and empty values', async () => {
      const mockFetch = makeMockFetch({ access_token: 'at' });
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      await client.exchangeAuthorizationCode({
        providerId: 'gemini',
        tokenUrl: 'https://oauth.example.com/token',
        clientId: 'client-1',
        code: 'code',
        redirectUri: 'https://app.example.com/callback',
        scopes: ['read']
      });
      const body = mockFetch.mock.calls[0][1].body as string;
      expect(body).toContain('client_id=client-1');
      expect(body).not.toContain('client_secret');
    });
  });

  describe('normalizeTokenResponse edge cases', () => {
    it('handles missing optional fields', async () => {
      const mockFetch = makeMockFetch({
        access_token: 'at-minimal'
      });
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      const result = await client.exchangeAuthorizationCode({
        providerId: 'gemini',
        tokenUrl: 'https://oauth.example.com/token',
        clientId: 'client-1',
        code: 'code',
        redirectUri: 'https://app.example.com/callback',
        scopes: ['read']
      });
      expect(result.accessToken).toBe('at-minimal');
      expect(result.refreshToken).toBeUndefined();
      expect(result.tokenType).toBeUndefined();
      expect(result.expiresIn).toBeUndefined();
      expect(result.scope).toBeUndefined();
    });

    it('returns undefined for empty string optional fields', async () => {
      const mockFetch = makeMockFetch({
        access_token: 'at-1',
        refresh_token: '',
        token_type: '',
        scope: ''
      });
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      const result = await client.exchangeAuthorizationCode({
        providerId: 'gemini',
        tokenUrl: 'https://oauth.example.com/token',
        clientId: 'client-1',
        code: 'code',
        redirectUri: 'https://app.example.com/callback',
        scopes: ['read']
      });
      expect(result.refreshToken).toBeUndefined();
      expect(result.tokenType).toBeUndefined();
      expect(result.scope).toBeUndefined();
    });

    it('handles non-finite expiresIn', async () => {
      const mockFetch = makeMockFetch({
        access_token: 'at-1',
        expires_in: Infinity
      });
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      const result = await client.exchangeAuthorizationCode({
        providerId: 'gemini',
        tokenUrl: 'https://oauth.example.com/token',
        clientId: 'client-1',
        code: 'code',
        redirectUri: 'https://app.example.com/callback',
        scopes: ['read']
      });
      expect(result.expiresIn).toBeUndefined();
    });
  });

  describe('missing required fields', () => {
    it('throws when device_code is missing', async () => {
      const mockFetch = makeMockFetch({
        user_code: 'ABCD',
        verification_uri: 'https://device.example.com',
        expires_in: 600
      });
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      await expect(
        client.startDeviceAuthorization({
          providerId: 'gemini',
          deviceUrl: 'https://oauth.example.com/device',
          clientId: 'client-1',
          scopes: ['read']
        })
      ).rejects.toThrow('device_code');
    });

    it('throws when access_token is missing', async () => {
      const mockFetch = makeMockFetch({
        token_type: 'Bearer'
      });
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      await expect(
        client.exchangeAuthorizationCode({
          providerId: 'gemini',
          tokenUrl: 'https://oauth.example.com/token',
          clientId: 'client-1',
          code: 'code',
          redirectUri: 'https://app.example.com/callback',
          scopes: ['read']
        })
      ).rejects.toThrow('access_token');
    });

    it('throws when expires_in is not a number', async () => {
      const mockFetch = makeMockFetch({
        device_code: 'dc-1',
        user_code: 'UC-1',
        verification_uri: 'https://device.example.com',
        expires_in: 'not-a-number'
      });
      const client = new FetchGatewayOAuthHttpClient(mockFetch);
      await expect(
        client.startDeviceAuthorization({
          providerId: 'gemini',
          deviceUrl: 'https://oauth.example.com/device',
          clientId: 'client-1',
          scopes: ['read']
        })
      ).rejects.toThrow('expires_in');
    });
  });
});
