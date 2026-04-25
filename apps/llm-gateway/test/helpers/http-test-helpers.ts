export interface JsonRequestOptions {
  method?: string;
  headers?: HeadersInit;
  body?: unknown;
}

export interface SseReadResult {
  text: string;
  events: string[];
  jsonEvents: unknown[];
  done: boolean;
}

export function createJsonRequest(url: string, options: JsonRequestOptions = {}): Request {
  const headers = new Headers(options.headers);
  const init: RequestInit = {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers
  };

  if (options.body !== undefined) {
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    init.body = JSON.stringify(options.body);
  }

  return new Request(url, init);
}

export async function readJsonResponse<T = unknown>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function readSseResponse(response: Response): Promise<SseReadResult> {
  const text = await response.text();
  const events = text
    .split('\n')
    .filter(line => line.startsWith('data: '))
    .map(line => line.slice('data: '.length));

  return {
    text,
    events,
    jsonEvents: events.filter(event => event !== '[DONE]').map(event => JSON.parse(event) as unknown),
    done: events.includes('[DONE]')
  };
}
