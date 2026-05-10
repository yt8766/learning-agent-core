import { Injectable } from '@nestjs/common';
import type {
  GatewayConfig,
  GatewayCredentialFile,
  GatewayLogEntry,
  GatewayProviderCredentialSet,
  GatewayQuota,
  GatewayUpdateConfigRequest,
  GatewayUsageRecord
} from '@agent/core';
import type { AgentGatewayRepository } from './agent-gateway.repository';

const observedAt = '2026-05-07T00:00:00.000Z';

@Injectable()
export class MemoryAgentGatewayRepository implements AgentGatewayRepository {
  private config: GatewayConfig = {
    inputTokenStrategy: 'preprocess',
    outputTokenStrategy: 'postprocess',
    retryLimit: 2,
    circuitBreakerEnabled: true,
    auditEnabled: true
  };

  private readonly providers = new Map<string, GatewayProviderCredentialSet>([
    [
      'openai-primary',
      {
        id: 'openai-primary',
        provider: 'OpenAI 主通道',
        modelFamilies: ['gpt-5.4'],
        status: 'healthy',
        priority: 1,
        baseUrl: 'https://api.openai.com/v1',
        timeoutMs: 60000
      }
    ],
    [
      'anthropic-backup',
      {
        id: 'anthropic-backup',
        provider: 'Anthropic 备用通道',
        modelFamilies: ['claude-4'],
        status: 'degraded',
        priority: 2,
        baseUrl: 'https://api.anthropic.com/v1',
        timeoutMs: 60000
      }
    ]
  ]);

  private readonly credentialFiles = new Map<string, GatewayCredentialFile>([
    [
      'openai-env',
      {
        id: 'openai-env',
        provider: 'OpenAI 主通道',
        path: 'apps/backend/agent-server/.env',
        status: 'valid',
        lastCheckedAt: observedAt
      }
    ]
  ]);

  private readonly quotas = new Map<string, GatewayQuota>([
    [
      'openai-daily',
      {
        id: 'openai-daily',
        provider: 'OpenAI 主通道',
        scope: 'daily',
        usedTokens: 124000,
        limitTokens: 500000,
        resetAt: '2026-05-08T00:00:00.000Z',
        status: 'normal'
      }
    ]
  ]);

  private readonly logs: GatewayLogEntry[] = [
    {
      id: 'log-1',
      occurredAt: observedAt,
      level: 'info',
      stage: 'preprocess',
      provider: 'OpenAI 主通道',
      message: '完成输入 token 估算与提示词标准化',
      inputTokens: 1200,
      outputTokens: 0
    }
  ];

  private readonly usage: GatewayUsageRecord[] = [
    {
      id: 'usage-1',
      provider: 'OpenAI 主通道',
      date: '2026-05-07',
      requestCount: 128,
      inputTokens: 82000,
      outputTokens: 42000,
      estimatedCostUsd: 18.4
    }
  ];

  async getConfig(): Promise<GatewayConfig> {
    return { ...this.config };
  }

  async updateConfig(request: GatewayUpdateConfigRequest): Promise<GatewayConfig> {
    this.config = { ...this.config, ...request };
    return this.getConfig();
  }

  async listProviders(): Promise<GatewayProviderCredentialSet[]> {
    return [...this.providers.values()].map(provider => ({ ...provider, modelFamilies: [...provider.modelFamilies] }));
  }

  async upsertProvider(provider: GatewayProviderCredentialSet): Promise<GatewayProviderCredentialSet> {
    const next = { ...provider, modelFamilies: [...provider.modelFamilies] };
    this.providers.set(next.id, next);
    return { ...next, modelFamilies: [...next.modelFamilies] };
  }

  async deleteProvider(providerId: string): Promise<void> {
    this.providers.delete(providerId);
  }

  async listCredentialFiles(): Promise<GatewayCredentialFile[]> {
    return [...this.credentialFiles.values()].map(file => ({ ...file }));
  }

  async upsertCredentialFile(file: GatewayCredentialFile): Promise<GatewayCredentialFile> {
    this.credentialFiles.set(file.id, { ...file });
    return { ...file };
  }

  async deleteCredentialFile(fileId: string): Promise<void> {
    this.credentialFiles.delete(fileId);
  }

  async listQuotas(): Promise<GatewayQuota[]> {
    return [...this.quotas.values()].map(quota => ({ ...quota }));
  }

  async updateQuota(quota: GatewayQuota): Promise<GatewayQuota> {
    this.quotas.set(quota.id, { ...quota });
    return { ...quota };
  }

  async appendLog(entry: GatewayLogEntry): Promise<GatewayLogEntry> {
    this.logs.unshift({ ...entry });
    return { ...entry };
  }

  async listLogs(limit: number): Promise<GatewayLogEntry[]> {
    return this.logs.slice(0, this.limit(limit)).map(log => ({ ...log }));
  }

  async appendUsage(record: GatewayUsageRecord): Promise<GatewayUsageRecord> {
    this.usage.unshift({ ...record });
    return { ...record };
  }

  async listUsage(limit: number): Promise<GatewayUsageRecord[]> {
    return this.usage.slice(0, this.limit(limit)).map(record => ({ ...record }));
  }

  private limit(limit: number): number {
    return Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 50;
  }
}
