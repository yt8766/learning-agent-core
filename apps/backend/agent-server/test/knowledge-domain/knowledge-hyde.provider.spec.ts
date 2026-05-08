import { describe, expect, it, vi } from 'vitest';

import { createKnowledgeHydeProvider } from '../../src/domains/knowledge/rag/knowledge-hyde.provider';

describe('KnowledgeHydeProvider', () => {
  it('generates a trimmed hypothetical answer via the LLM boundary', async () => {
    const generate = vi.fn(async () => ({
      text: '  Rotate signing keys every 90 days for security.  '
    }));
    const provider = createKnowledgeHydeProvider({ generate, modelId: 'hyde-model' });

    const result = await provider.generateHypotheticalAnswer('How often should we rotate keys?');

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'hyde-model',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('How often should we rotate keys?')
          })
        ])
      })
    );
    expect(result).toBe('Rotate signing keys every 90 days for security.');
  });
});
