import {
  GatewayAccountingResponseSchema,
  GatewayLogListResponseSchema,
  GatewayPreprocessResponseSchema,
  GatewayProbeResponseSchema,
  GatewaySnapshotSchema,
  GatewayUsageListResponseSchema,
  type GatewayAccountingRequest,
  type GatewayAccountingResponse,
  type GatewayLogListResponse,
  type GatewayPreprocessRequest,
  type GatewayPreprocessResponse,
  type GatewayProbeRequest,
  type GatewayProbeResponse,
  type GatewaySnapshot,
  type GatewayUsageListResponse
} from '@agent/core';

interface AgentGatewayApiClientOptions {
  baseUrl?: string;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
}

interface ParseableSchema<T> {
  parse(payload: unknown): T;
}

interface GatewayErrorPayload {
  code?: string;
  message?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

export class AgentGatewayApiClient {
  private readonly baseUrl: string;

  private readonly options: AgentGatewayApiClientOptions;

  constructor(options: AgentGatewayApiClientOptions) {
    this.options = options;
    this.baseUrl = options.baseUrl ?? '';
  }

  snapshot(): Promise<GatewaySnapshot> {
    return this.get('/agent-gateway/snapshot', GatewaySnapshotSchema);
  }

  logs(limit = 50): Promise<GatewayLogListResponse> {
    return this.get(`/agent-gateway/logs?limit=${limit}`, GatewayLogListResponseSchema);
  }

  usage(limit = 50): Promise<GatewayUsageListResponse> {
    return this.get(`/agent-gateway/usage?limit=${limit}`, GatewayUsageListResponseSchema);
  }

  probe(request: GatewayProbeRequest): Promise<GatewayProbeResponse> {
    return this.post('/agent-gateway/probe', request, GatewayProbeResponseSchema);
  }

  preprocess(request: GatewayPreprocessRequest): Promise<GatewayPreprocessResponse> {
    return this.post('/agent-gateway/preprocess', request, GatewayPreprocessResponseSchema);
  }

  accounting(request: GatewayAccountingRequest): Promise<GatewayAccountingResponse> {
    return this.post('/agent-gateway/accounting', request, GatewayAccountingResponseSchema);
  }

  private get<T>(path: string, schema: ParseableSchema<T>): Promise<T> {
    return this.request(path, schema);
  }

  private post<T>(path: string, body: unknown, schema: ParseableSchema<T>): Promise<T> {
    return this.request(path, schema, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  private async request<T>(path: string, schema: ParseableSchema<T>, init: RequestInit = {}, retry = true): Promise<T> {
    const token = this.options.getAccessToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        ...(token ? { authorization: `Bearer ${token}` } : {})
      }
    });
    const payload = (await response.json()) as unknown;
    if (response.ok) {
      return schema.parse(payload);
    }

    const errorPayload = payload as GatewayErrorPayload;
    const code = errorPayload.error?.code ?? errorPayload.code;
    if (response.status === 401 && code === 'ACCESS_TOKEN_EXPIRED' && retry) {
      const refreshedToken = await this.options.refreshAccessToken();
      if (refreshedToken) {
        return this.request(path, schema, init, false);
      }
    }
    throw new Error(errorPayload.error?.message ?? errorPayload.message ?? '网关请求失败');
  }
}
