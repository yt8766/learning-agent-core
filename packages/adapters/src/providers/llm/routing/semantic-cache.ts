export interface SemanticCacheRecord {
  id: string;
  key: string;
  role: string;
  modelId: string;
  responseText: string;
  promptFingerprint: string;
  createdAt: string;
  updatedAt: string;
  hitCount: number;
}

export interface SemanticCacheRepository {
  get(key: string): Promise<SemanticCacheRecord | undefined>;
  set(record: SemanticCacheRecord): Promise<void>;
}
