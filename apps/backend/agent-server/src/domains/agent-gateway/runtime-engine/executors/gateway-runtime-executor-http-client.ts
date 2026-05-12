export interface GatewayRuntimeExecutorHttpRequest {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  stream?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface GatewayRuntimeExecutorHttpResponse {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
  stream?: AsyncIterable<unknown>;
}

export interface GatewayRuntimeExecutorHttpClient {
  request(request: GatewayRuntimeExecutorHttpRequest): Promise<GatewayRuntimeExecutorHttpResponse>;
}

export class FetchGatewayRuntimeExecutorHttpClient implements GatewayRuntimeExecutorHttpClient {
  async request(request: GatewayRuntimeExecutorHttpRequest): Promise<GatewayRuntimeExecutorHttpResponse> {
    const abort = composeAbortSignal(request.signal, request.timeoutMs);
    const response = await fetch(request.url, {
      method: request.method,
      headers: {
        ...request.headers,
        ...(request.body === undefined ? {} : { 'content-type': 'application/json' })
      },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: abort.signal
    });
    if (request.stream) {
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: null,
        stream: decodeResponseStream(response)
      };
    }
    const text = await response.text();
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: parseJsonBody(text)
    };
  }
}

function composeAbortSignal(signal: AbortSignal | undefined, timeoutMs: number | undefined): { signal?: AbortSignal } {
  if (!signal && !timeoutMs) return {};

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (timeoutMs) setTimeout(abort, timeoutMs).unref?.();
  return { signal: controller.signal };
}

async function* decodeResponseStream(response: Response): AsyncIterable<string> {
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
    const remaining = decoder.decode();
    if (remaining) yield remaining;
  } finally {
    reader.releaseLock();
  }
}

function parseJsonBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}
