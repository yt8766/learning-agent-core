import { z } from 'zod/v4';
import { describe, expect, it } from 'vitest';

import { safeGenerateObject } from '@agent/adapters';

describe('@agent/adapters safeGenerateObject', () => {
  it('returns a not_configured fallback when the provider is unavailable', async () => {
    await expect(
      safeGenerateObject({
        contractName: 'demo-contract',
        contractVersion: 'v1',
        isConfigured: false,
        invoke: async () => ({ ok: true })
      })
    ).resolves.toEqual({
      object: null,
      meta: {
        contractName: 'demo-contract',
        contractVersion: 'v1',
        parseStatus: 'not_configured',
        fallbackUsed: true,
        fallbackReason: 'LLM provider is not configured.'
      }
    });
  });

  it('parses a structured result when the schema matches', async () => {
    const schema = z.object({
      title: z.string().min(1)
    });

    await expect(
      safeGenerateObject({
        contractName: 'demo-contract',
        contractVersion: 'v1',
        isConfigured: true,
        schema,
        invoke: async () => ({ title: 'report-ready' })
      })
    ).resolves.toEqual({
      object: { title: 'report-ready' },
      meta: {
        contractName: 'demo-contract',
        contractVersion: 'v1',
        parseStatus: 'success',
        fallbackUsed: false
      }
    });
  });

  it('classifies schema parse failures and returns a fallback result', async () => {
    const schema = z.object({
      title: z.string().min(1)
    });

    const result = await safeGenerateObject({
      contractName: 'demo-contract',
      contractVersion: 'v1',
      isConfigured: true,
      schema,
      invoke: async () => ({ title: 123 })
    });

    expect(result.object).toBeNull();
    expect(result.meta.parseStatus).toBe('schema_parse_failed');
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.fallbackReason).toMatch(/expected string/i);
  });
});
