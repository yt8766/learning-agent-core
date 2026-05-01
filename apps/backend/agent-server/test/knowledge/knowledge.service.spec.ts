import { describe, expect, it } from 'vitest';

import { KnowledgeService } from '../../src/knowledge/knowledge.service';

describe('KnowledgeService', () => {
  it('returns access and refresh tokens on login', async () => {
    const service = new KnowledgeService();

    const result = await service.login({ email: 'dev@example.com', password: 'secret' });

    expect(result.user.email).toBe('dev@example.com');
    expect(result.tokens.tokenType).toBe('Bearer');
    expect(result.tokens.accessToken).toContain('knowledge-access');
    expect(result.tokens.refreshToken).toContain('knowledge-refresh');
  });

  it('refreshes tokens', async () => {
    const service = new KnowledgeService();

    const result = await service.refresh({ refreshToken: 'knowledge-refresh:user_1:1' });

    expect(result.tokens.accessToken).toContain('knowledge-access');
    expect(result.tokens.refreshToken).toContain('knowledge-refresh');
  });
});
