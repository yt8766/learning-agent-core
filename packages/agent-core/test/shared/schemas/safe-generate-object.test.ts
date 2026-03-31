import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { safeGenerateObject } from '../../../src/shared/schemas/safe-generate-object';

describe('safeGenerateObject', () => {
  it('returns success meta when object matches schema', async () => {
    const result = await safeGenerateObject({
      contractName: 'demo-contract',
      contractVersion: 'demo-contract.v1',
      isConfigured: true,
      schema: z.object({
        ok: z.boolean()
      }),
      invoke: async () => ({ ok: true })
    });

    expect(result).toEqual({
      object: { ok: true },
      meta: {
        contractName: 'demo-contract',
        contractVersion: 'demo-contract.v1',
        parseStatus: 'success',
        fallbackUsed: false
      }
    });
  });

  it('returns schema_parse_failed meta when schema parsing fails', async () => {
    const result = await safeGenerateObject({
      contractName: 'demo-contract',
      contractVersion: 'demo-contract.v1',
      isConfigured: true,
      schema: z.object({
        ok: z.boolean()
      }),
      invoke: async () => ({ ok: 'bad' }) as unknown as { ok: boolean }
    });

    expect(result.object).toBeNull();
    expect(result.meta.parseStatus).toBe('schema_parse_failed');
    expect(result.meta.fallbackUsed).toBe(true);
  });
});
