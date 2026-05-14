import { describe, expect, it, vi } from 'vitest';
import { getApiCallErrorMessage } from '../src/services/api/apiCall';
import { DEFAULT_API_PORT } from '../src/utils/constants';
import { computeApiUrl, isLocalhost, normalizeApiBase } from '../src/utils/connection';

describe('agent-gateway current API utilities', () => {
  it('normalizes management API bases without preserving legacy management suffixes', () => {
    expect(normalizeApiBase('localhost:5176/v0/management/')).toBe('http://localhost:5176');
    expect(computeApiUrl('https://gateway.example.com/')).toBe('https://gateway.example.com/v0/management');
  });

  it('recognizes local gateway hosts', () => {
    expect(isLocalhost('localhost')).toBe(true);
    expect(isLocalhost('127.0.0.1')).toBe(true);
    expect(isLocalhost('gateway.example.com')).toBe(false);
  });

  it('extracts stable API call error messages from current management responses', () => {
    expect(
      getApiCallErrorMessage({
        statusCode: 502,
        header: {},
        bodyText: '',
        body: { error: { message: 'provider unavailable' } }
      })
    ).toBe('502 provider unavailable');

    expect(
      getApiCallErrorMessage({
        statusCode: 0,
        header: {},
        bodyText: 'raw failure',
        body: null
      })
    ).toBe('raw failure');
  });

  it('falls back to the default API base when browser location is unavailable', async () => {
    const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const originalWindow = globalThis.window;

    try {
      vi.stubGlobal('window', undefined);
      const { detectApiBaseFromLocation } = await import('../src/utils/connection');

      expect(detectApiBaseFromLocation()).toBe(`http://localhost:${DEFAULT_API_PORT}`);
    } finally {
      vi.stubGlobal('window', originalWindow);
      warningSpy.mockRestore();
    }
  });
});
