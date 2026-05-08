import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import { KNOWLEDGE_SDK_RUNTIME } from '../../src/domains/knowledge/knowledge-domain.tokens';
import { KnowledgeDomainModule } from '../../src/domains/knowledge/knowledge-domain.module';
import type { KnowledgeIngestionQueue } from '../../src/domains/knowledge/services/knowledge-ingestion.queue';

describe('KnowledgeDomainModule', () => {
  it('starts the ingestion queue when the Nest module initializes', () => {
    const queue = {
      start: vi.fn(),
      stop: vi.fn()
    } as unknown as KnowledgeIngestionQueue;
    const moduleRef = new KnowledgeDomainModule(queue);

    moduleRef.onModuleInit();

    expect(queue.start).toHaveBeenCalledTimes(1);
  });

  it('stops the ingestion queue when the Nest module is destroyed', () => {
    const queue = {
      start: vi.fn(),
      stop: vi.fn()
    } as unknown as KnowledgeIngestionQueue;
    const moduleRef = new KnowledgeDomainModule(queue);

    moduleRef.onModuleDestroy();

    expect(queue.stop).toHaveBeenCalledTimes(1);
  });

  it('registers the SDK runtime provider as disabled when SDK env is absent', async () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('KNOWLEDGE_CHAT_MODEL', '');
    vi.stubEnv('KNOWLEDGE_EMBEDDING_MODEL', '');
    vi.stubEnv('KNOWLEDGE_LLM_API_KEY', '');

    const moduleRef = await Test.createTestingModule({ imports: [KnowledgeDomainModule] }).compile();

    expect(moduleRef.get(KNOWLEDGE_SDK_RUNTIME)).toMatchObject({ enabled: false, runtime: null });
  });
});
