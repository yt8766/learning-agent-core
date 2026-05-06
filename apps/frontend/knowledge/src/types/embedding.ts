export type EmbeddingModelStatus = 'active' | 'disabled' | 'available' | 'unconfigured' | 'degraded';

export interface EmbeddingModelOption {
  id: string;
  name: string;
  provider: string;
  dimension?: number;
  description?: string;
  status?: EmbeddingModelStatus;
}
