import { describe, expect, it, vi } from 'vitest';

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
});
