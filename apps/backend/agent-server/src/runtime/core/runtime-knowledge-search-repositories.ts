import { listKnowledgeArtifacts } from '@agent/knowledge';
import type {
  KnowledgeChunk,
  KnowledgeChunkRepository,
  KnowledgeSource,
  KnowledgeSourceRepository
} from '@agent/knowledge';

export type RuntimeKnowledgeSettings = Parameters<typeof listKnowledgeArtifacts>[0];

export class SnapshotKnowledgeSourceRepository implements KnowledgeSourceRepository {
  constructor(private readonly settings: RuntimeKnowledgeSettings) {}

  async list(): Promise<KnowledgeSource[]> {
    const artifacts = await listKnowledgeArtifacts(this.settings);
    return artifacts.sources;
  }

  async getById(id: string): Promise<KnowledgeSource | null> {
    const sources = await this.list();
    return sources.find(source => source.id === id) ?? null;
  }

  async upsert(): Promise<void> {
    throw new Error('SnapshotKnowledgeSourceRepository is read-only in runtime search wiring');
  }
}

export class SnapshotKnowledgeChunkRepository implements KnowledgeChunkRepository {
  constructor(private readonly settings: RuntimeKnowledgeSettings) {}

  async list(): Promise<KnowledgeChunk[]> {
    const artifacts = await listKnowledgeArtifacts(this.settings);
    return artifacts.chunks;
  }

  async getByIds(ids: string[]): Promise<KnowledgeChunk[]> {
    const chunks = await this.list();
    const chunksById = new Map(chunks.map(chunk => [chunk.id, chunk]));
    return ids.flatMap(id => {
      const chunk = chunksById.get(id);
      return chunk ? [chunk] : [];
    });
  }

  async listBySourceId(sourceId: string): Promise<KnowledgeChunk[]> {
    const chunks = await this.list();
    return chunks.filter(chunk => chunk.sourceId === sourceId);
  }

  async upsert(): Promise<void> {
    throw new Error('SnapshotKnowledgeChunkRepository is read-only in runtime search wiring');
  }
}
