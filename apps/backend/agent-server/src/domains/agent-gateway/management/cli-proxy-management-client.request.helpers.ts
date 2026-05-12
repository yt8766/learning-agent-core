import { asRecord, type RecordBody, throwProxyError } from './cli-proxy-management-client.helpers';

export type CliProxyFetcher = (input: string, init?: RequestInit) => Promise<Response>;

interface CliProxyRequestContext {
  apiBase: () => string;
  managementKey: () => string;
  fetcher: CliProxyFetcher;
}

export interface CliProxyRequester {
  requestJson(
    path: string,
    method?: string,
    body?: unknown,
    contentType?: string
  ): Promise<{ response: Response; body: RecordBody }>;
  requestText(
    path: string,
    method?: string,
    body?: string,
    contentType?: string
  ): Promise<{ response: Response; body: string }>;
}

export function createCliProxyRequester(context: CliProxyRequestContext): CliProxyRequester {
  const request = async (path: string, method: string, body?: string, contentType?: string): Promise<Response> => {
    const managementKey = context.managementKey();
    const headers: Record<string, string> = {
      authorization: `Bearer ${managementKey}`,
      'x-management-key': managementKey
    };
    if (contentType) headers['content-type'] = contentType;
    const response = await context.fetcher(`${context.apiBase()}${path}`, { method, headers, body });
    if (!response.ok) await throwProxyError(response);
    return response;
  };

  return {
    async requestJson(path, method = 'GET', body, contentType = 'application/json') {
      const response = await request(
        path,
        method,
        body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
        body === undefined ? undefined : contentType
      );
      return { response, body: asRecord(await response.json()) };
    },
    async requestText(path, method = 'GET', body, contentType) {
      const response = await request(path, method, body, contentType);
      return { response, body: await response.text() };
    }
  };
}
