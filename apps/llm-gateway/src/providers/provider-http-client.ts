import { GatewayProviderError } from './provider-adapter';
import { mapProviderFetchError, mapProviderHttpStatus } from './provider-error-mapping';

interface FetchProviderJsonOptions {
  baseUrl: string;
  path: string;
  init?: RequestInit;
  timeoutMs: number;
  providerId?: string;
  fetchFn?: typeof fetch;
}

function trimSlashes(value: string, side: 'left' | 'right'): string {
  return side === 'left' ? value.replace(/^\/+/, '') : value.replace(/\/+$/, '');
}

export function joinProviderUrl(baseUrl: string, path: string): string {
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(path) || path.startsWith('//')) {
    throw new Error('Provider request path must be relative');
  }

  return `${trimSlashes(baseUrl, 'right')}/${trimSlashes(path, 'left')}`;
}

export async function parseProviderJsonResponse<T = unknown>(response: Response, providerId = 'provider'): Promise<T> {
  const text = await response.text();

  if (!response.ok) {
    throw mapProviderHttpStatus({
      providerId,
      status: response.status,
      statusText: response.statusText,
      bodyText: text
    });
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GatewayProviderError(`Provider ${providerId} returned malformed JSON`);
  }
}

export async function fetchProviderJson<T = unknown>(options: FetchProviderJsonOptions): Promise<T> {
  const providerId = options.providerId ?? 'provider';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const fetchFn = options.fetchFn ?? fetch;

  try {
    const response = await fetchFn(joinProviderUrl(options.baseUrl, options.path), {
      ...options.init,
      signal: controller.signal
    });

    return await parseProviderJsonResponse<T>(response, providerId);
  } catch (error) {
    if (error instanceof GatewayProviderError) {
      throw error;
    }

    throw mapProviderFetchError(providerId, error);
  } finally {
    clearTimeout(timeout);
  }
}
