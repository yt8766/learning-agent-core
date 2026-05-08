import type { SemanticCacheRecord } from './schemas/semantic-cache.schema';

export interface SemanticCacheRepository {
  get(key: string): Promise<SemanticCacheRecord | undefined>;
  set(record: SemanticCacheRecord): Promise<void>;
}
