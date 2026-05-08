import {
  GatewayLoginResponseSchema,
  GatewayRefreshResponseSchema,
  type GatewayLoginResponse,
  type GatewayRefreshResponse
} from '@agent/core';
export interface GatewayAuthApi {
  login(username: string, password: string): Promise<GatewayLoginResponse>;
  refresh(refreshToken: string): Promise<GatewayRefreshResponse>;
}
export function createGatewayAuthApi(baseUrl = ''): GatewayAuthApi {
  return {
    async login(username, password) {
      return GatewayLoginResponseSchema.parse(
        await postJson(baseUrl + '/agent-gateway/auth/login', { username, password })
      );
    },
    async refresh(refreshToken) {
      return GatewayRefreshResponseSchema.parse(
        await postJson(baseUrl + '/agent-gateway/auth/refresh', { refreshToken })
      );
    }
  };
}
async function postJson(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error('请求失败');
  return payload;
}
