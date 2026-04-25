import { GatewayProviderError } from './provider-adapter';

interface ProviderHttpStatusInput {
  providerId: string;
  status: number;
  statusText?: string;
  bodyText?: string;
}

const SECRET_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\b(api[_-]?key|access[_-]?token|secret|token)=([^\s&]+)/gi,
  /\bsk-[A-Za-z0-9_-]{6,}\b/g
];

function truncateDiagnosticText(text: string): string {
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

export function sanitizeProviderErrorMessage(message: string): string {
  return SECRET_PATTERNS.reduce((sanitized, pattern) => {
    if (pattern.source.includes('Bearer')) {
      return sanitized.replace(pattern, 'Bearer [REDACTED]');
    }

    if (pattern.source.includes('api')) {
      return sanitized.replace(pattern, '$1=[REDACTED]');
    }

    return sanitized.replace(pattern, '[REDACTED]');
  }, message);
}

function providerStatusReason(status: number): string {
  if (status === 401 || status === 403) {
    return 'authentication failed';
  }

  if (status === 429) {
    return 'rate limited';
  }

  if (status >= 500) {
    return 'unavailable';
  }

  return 'returned an invalid response';
}

export function mapProviderHttpStatus(input: ProviderHttpStatusInput): GatewayProviderError {
  const statusText = input.statusText ? ` ${sanitizeProviderErrorMessage(input.statusText)}` : '';
  const bodyText = input.bodyText ? `: ${truncateDiagnosticText(sanitizeProviderErrorMessage(input.bodyText))}` : '';
  const reason = providerStatusReason(input.status);

  return new GatewayProviderError(
    `Provider ${input.providerId} ${reason} (HTTP ${input.status}${statusText})${bodyText}`
  );
}

export function mapProviderFetchError(providerId: string, error: unknown): GatewayProviderError {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new GatewayProviderError(`Provider ${providerId} request timed out`);
  }

  return new GatewayProviderError(`Provider ${providerId} request failed`);
}
