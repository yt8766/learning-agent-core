import axios, { type AxiosRequestConfig } from 'axios';
import { voidResponseSchema } from './agent-gateway-api.schemas';
import type { AgentGatewayApiClientOptions, GatewayErrorPayload, ParseableSchema } from './agent-gateway-api.types';

export class AgentGatewayApiTransport {
  private readonly baseUrl: string;

  private readonly options: AgentGatewayApiClientOptions;

  constructor(options: AgentGatewayApiClientOptions) {
    this.options = options;
    this.baseUrl = options.baseUrl ?? '/api';
  }

  get<T>(path: string, schema: ParseableSchema<T>): Promise<T> {
    return this.request(path, schema);
  }

  post<T>(path: string, body: unknown, schema: ParseableSchema<T>): Promise<T> {
    return this.request(path, schema, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: body
    });
  }

  put<T>(path: string, body: unknown, schema: ParseableSchema<T>): Promise<T> {
    return this.request(path, schema, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      data: body
    });
  }

  patch<T>(path: string, body: unknown, schema: ParseableSchema<T>): Promise<T> {
    return this.request(path, schema, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      data: body
    });
  }

  delete(path: string): Promise<void> {
    return this.request(path, voidResponseSchema, {
      method: 'DELETE'
    });
  }

  deleteWithBodylessResponse<T>(path: string, schema: ParseableSchema<T>): Promise<T> {
    return this.request(path, schema, {
      method: 'DELETE'
    });
  }

  deleteWithBody<T>(path: string, body: unknown, schema: ParseableSchema<T>): Promise<T> {
    return this.request(path, schema, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      data: body
    });
  }

  private async request<T>(
    path: string,
    schema: ParseableSchema<T>,
    init: AxiosRequestConfig = {},
    retry = true
  ): Promise<T> {
    const token = this.options.getAccessToken();
    const response = await axios.request({
      ...init,
      url: `${this.baseUrl}${path}`,
      headers: {
        ...init.headers,
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      validateStatus: () => true
    });
    const payload = response.data as unknown;
    if (response.status >= 200 && response.status < 300) {
      return schema.parse(payload);
    }

    const errorPayload = payload as GatewayErrorPayload;
    const code = errorPayload.error?.code ?? errorPayload.code;
    if (response.status === 401 && isRefreshableAuthError(code) && retry) {
      const refreshedToken = await this.options.refreshAccessToken();
      if (refreshedToken) {
        return this.request(path, schema, init, false);
      }
    }
    throw new Error(errorPayload.error?.message ?? errorPayload.message ?? '网关请求失败');
  }
}

function isRefreshableAuthError(code: string | undefined): boolean {
  return code === 'ACCESS_TOKEN_EXPIRED' || code === 'UNAUTHENTICATED';
}
