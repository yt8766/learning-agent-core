import { describe, expect, it } from 'vitest';
import {
  mapProviderFetchError,
  mapProviderHttpStatus,
  sanitizeProviderErrorMessage
} from '../src/providers/provider-error-mapping.js';

describe('provider error mapping helpers', () => {
  it('maps provider HTTP status to a GatewayProviderError with sanitized context', () => {
    const error = mapProviderHttpStatus({
      providerId: 'openai',
      status: 401,
      statusText: 'Unauthorized',
      bodyText: 'invalid api key sk-live-secret-token Authorization: Bearer provider-secret'
    });

    expect(error).toMatchObject({
      name: 'GatewayProviderError',
      code: 'UPSTREAM_UNAVAILABLE',
      status: 503
    });
    expect(error.message).toContain('openai');
    expect(error.message).toContain('401');
    expect(error.message).not.toContain('sk-live-secret-token');
    expect(error.message).not.toContain('provider-secret');
  });

  it('keeps rate limit and unavailable statuses distinguishable in the message', () => {
    expect(
      mapProviderHttpStatus({
        providerId: 'minimax',
        status: 429,
        statusText: 'Too Many Requests'
      }).message
    ).toContain('rate limited');

    expect(
      mapProviderHttpStatus({
        providerId: 'minimax',
        status: 503,
        statusText: 'Service Unavailable'
      }).message
    ).toContain('unavailable');
  });

  it('maps timeout and abort failures without leaking raw provider error details', () => {
    const error = mapProviderFetchError('mimo', new DOMException('request aborted with sk-test-secret', 'AbortError'));

    expect(error).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(error.message).toContain('timed out');
    expect(error.message).not.toContain('sk-test-secret');
  });

  it('redacts common provider secret shapes from diagnostic text', () => {
    expect(
      sanitizeProviderErrorMessage('Authorization: Bearer abc.def.ghi api_key=sk-provider-token access_token=secret')
    ).toBe('Authorization: Bearer [REDACTED] api_key=[REDACTED] access_token=[REDACTED]');
  });
});
