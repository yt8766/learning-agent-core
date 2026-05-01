import type {
  ChatRequest,
  ChatResponse,
  CreateFeedbackRequest,
  CreateKnowledgeBaseRequest,
  DashboardOverview,
  EvalDataset,
  EvalRun,
  KnowledgeBase,
  PageResult
} from '../types/api';
import type { AuthClient } from './auth-client';

export interface KnowledgeApiClientOptions {
  baseUrl: string;
  authClient: AuthClient;
  fetcher?: typeof fetch;
}

export class KnowledgeApiClient {
  private readonly baseUrl: string;
  private readonly authClient: AuthClient;
  private readonly fetcher: typeof fetch;

  constructor(options: KnowledgeApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.authClient = options.authClient;
    this.fetcher = options.fetcher ?? fetch;
  }

  getDashboardOverview() {
    return this.get<DashboardOverview>('/dashboard/overview');
  }

  listKnowledgeBases() {
    return this.get<PageResult<KnowledgeBase>>('/knowledge-bases');
  }

  createKnowledgeBase(input: CreateKnowledgeBaseRequest) {
    return this.post<KnowledgeBase>('/knowledge-bases', input);
  }

  chat(input: ChatRequest) {
    return this.post<ChatResponse>('/chat', input);
  }

  createFeedback(messageId: string, input: CreateFeedbackRequest) {
    return this.post(`/messages/${messageId}/feedback`, input);
  }

  listEvalDatasets() {
    return this.get<PageResult<EvalDataset>>('/eval/datasets');
  }

  listEvalRuns() {
    return this.get<PageResult<EvalRun>>('/eval/runs');
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async request<T>(path: string, init: RequestInit = {}, hasRetried = false): Promise<T> {
    const accessToken = await this.authClient.ensureValidAccessToken();
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: mergeHeaders(init.headers, accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    });

    if (response.status === 401 && !hasRetried) {
      const errorBody = await readJson(response.clone());
      if (isAuthTokenExpired(errorBody)) {
        await this.authClient.refreshTokensOnce();
        return this.request<T>(path, init, true);
      }
    }

    const body = await readJson(response);
    if (!response.ok) {
      throw new Error(getErrorMessage(body, response.status));
    }
    return body as T;
  }
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => undefined);
}

function isAuthTokenExpired(body: unknown) {
  return typeof body === 'object' && body && 'code' in body && body.code === 'auth_token_expired';
}

function getErrorMessage(body: unknown, status: number) {
  if (typeof body === 'object' && body && 'message' in body && typeof body.message === 'string') {
    return body.message;
  }
  return `HTTP ${status}`;
}

function mergeHeaders(input: HeadersInit | undefined, extra: Record<string, string>) {
  const headers = new Headers(input);
  for (const [key, value] of Object.entries(extra)) {
    headers.set(key, value);
  }
  return headers;
}
