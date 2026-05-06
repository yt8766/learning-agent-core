import { Injectable } from '@nestjs/common';
import type { KnowledgeProviderHealthStatus } from '@agent/knowledge';

export interface KnowledgeProviderHealthProbeResult {
  status: KnowledgeProviderHealthStatus;
  message?: string;
}

export type KnowledgeProviderHealthProbe = () =>
  | KnowledgeProviderHealthProbeResult
  | Promise<KnowledgeProviderHealthProbeResult>;

export interface KnowledgeProviderHealthProbes {
  embedding?: KnowledgeProviderHealthProbe;
  vector?: KnowledgeProviderHealthProbe;
  keyword?: KnowledgeProviderHealthProbe;
  generation?: KnowledgeProviderHealthProbe;
}

export interface KnowledgeProviderHealthProjection {
  embedding: KnowledgeProviderHealthStatus;
  vector: KnowledgeProviderHealthStatus;
  keyword: KnowledgeProviderHealthStatus;
  generation: KnowledgeProviderHealthStatus;
}

@Injectable()
export class KnowledgeProviderHealthService {
  constructor(private readonly probes: KnowledgeProviderHealthProbes = {}) {}

  async getProviderHealth(): Promise<KnowledgeProviderHealthProjection> {
    const [embedding, vector, keyword, generation] = await Promise.all([
      this.runProbe(this.probes.embedding),
      this.runProbe(this.probes.vector),
      this.runProbe(this.probes.keyword),
      this.runProbe(this.probes.generation)
    ]);
    return { embedding, vector, keyword, generation };
  }

  private async runProbe(probe?: KnowledgeProviderHealthProbe): Promise<KnowledgeProviderHealthStatus> {
    if (!probe) {
      return 'unconfigured';
    }
    try {
      return (await probe()).status;
    } catch {
      return 'degraded';
    }
  }
}
