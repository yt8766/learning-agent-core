import axios, { type AxiosRequestConfig } from 'axios';
import {
  AuthLoginResponseSchema,
  AuthMeResponseSchema,
  AuthRefreshResponseSchema,
  type AuthAccount,
  type GatewayLoginResponse,
  type GatewayRefreshResponse
} from '@agent/core';
export interface GatewayAuthApi {
  login(username: string, password: string): Promise<GatewayLoginResponse>;
  refresh(refreshToken: string): Promise<GatewayRefreshResponse>;
}
type GatewayAuthRequester = (config: AxiosRequestConfig) => Promise<{ status: number; data: unknown }>;

export function createGatewayAuthApi(
  baseUrl = '/api',
  requester: GatewayAuthRequester = axios.request
): GatewayAuthApi {
  return {
    async login(username, password) {
      const response = AuthLoginResponseSchema.parse(
        await postJson(requester, baseUrl + '/identity/login', { username, password })
      );
      return {
        accessToken: response.tokens.accessToken,
        refreshToken: response.tokens.refreshToken,
        accessTokenExpiresAt: response.tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: response.tokens.refreshTokenExpiresAt,
        refreshTokenStorage: 'localStorage',
        session: toGatewaySession(response.account)
      };
    },
    async refresh(refreshToken) {
      const response = AuthRefreshResponseSchema.parse(
        await postJson(requester, baseUrl + '/identity/refresh', { refreshToken })
      );
      const current = AuthMeResponseSchema.parse(
        await getJson(requester, baseUrl + '/identity/me', response.tokens.accessToken)
      );
      return {
        accessToken: response.tokens.accessToken,
        accessTokenExpiresAt: response.tokens.accessTokenExpiresAt,
        refreshToken: response.tokens.refreshToken,
        refreshTokenExpiresAt: response.tokens.refreshTokenExpiresAt,
        refreshTokenStorage: 'localStorage',
        session: toGatewaySession(current.account)
      };
    }
  };
}

function toGatewaySession(account: AuthAccount): GatewayLoginResponse['session'] {
  return {
    user: {
      id: account.id,
      username: account.username,
      displayName: account.displayName,
      role: toGatewayRole(account.roles)
    },
    issuedAt: new Date().toISOString()
  };
}

function toGatewayRole(roles: AuthAccount['roles']): GatewayLoginResponse['session']['user']['role'] {
  if (roles.includes('super_admin') || roles.includes('admin')) return 'admin';
  if (roles.includes('developer')) return 'operator';
  return 'viewer';
}

async function postJson(requester: GatewayAuthRequester, url: string, body: unknown): Promise<unknown> {
  const response = await requester({
    url,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    data: body,
    validateStatus: () => true
  });
  if (response.status < 200 || response.status >= 300) throw new Error('请求失败');
  return response.data;
}

const defaultGatewayAuthApi = createGatewayAuthApi();

export function getDefaultGatewayAuthApi(): GatewayAuthApi {
  return defaultGatewayAuthApi;
}

async function getJson(requester: GatewayAuthRequester, url: string, accessToken: string): Promise<unknown> {
  const response = await requester({
    url,
    headers: { authorization: `Bearer ${accessToken}` },
    validateStatus: () => true
  });
  if (response.status < 200 || response.status >= 300) throw new Error('请求失败');
  return response.data;
}
