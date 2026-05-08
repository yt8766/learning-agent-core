import { Injectable } from '@nestjs/common';
import type {
  GatewayAccountingRequest,
  GatewayAccountingResponse,
  GatewayCredentialFile,
  GatewayLogEntry,
  GatewayLogListResponse,
  GatewayPreprocessRequest,
  GatewayPreprocessResponse,
  GatewayProbeRequest,
  GatewayProbeResponse,
  GatewayProviderCredentialSet,
  GatewayQuota,
  GatewaySnapshot,
  GatewayTokenCountResponse,
  GatewayUsageListResponse,
  GatewayUsageRecord
} from '@agent/core';
const observedAt = '2026-05-07T00:00:00.000Z';
@Injectable()
export class AgentGatewayService {
  private readonly providers: GatewayProviderCredentialSet[] = [
    {
      id: 'openai-primary',
      provider: 'OpenAI 主通道',
      modelFamilies: ['gpt-5.4'],
      status: 'healthy',
      priority: 1,
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: 60000
    },
    {
      id: 'anthropic-backup',
      provider: 'Anthropic 备用通道',
      modelFamilies: ['claude-4'],
      status: 'degraded',
      priority: 2,
      baseUrl: 'https://api.anthropic.com/v1',
      timeoutMs: 60000
    }
  ];
  private readonly credentialFiles: GatewayCredentialFile[] = [
    {
      id: 'openai-env',
      provider: 'OpenAI 主通道',
      path: 'apps/backend/agent-server/.env',
      status: 'valid',
      lastCheckedAt: observedAt
    }
  ];
  private readonly quotas: GatewayQuota[] = [
    {
      id: 'openai-daily',
      provider: 'OpenAI 主通道',
      scope: 'daily',
      usedTokens: 124000,
      limitTokens: 500000,
      resetAt: '2026-05-08T00:00:00.000Z',
      status: 'normal'
    }
  ];
  snapshot(): GatewaySnapshot {
    return {
      observedAt: new Date().toISOString(),
      runtime: {
        mode: 'proxy',
        status: 'healthy',
        activeProviderCount: 1,
        degradedProviderCount: 1,
        requestPerMinute: 42,
        p95LatencyMs: 810
      },
      config: {
        inputTokenStrategy: 'preprocess',
        outputTokenStrategy: 'postprocess',
        retryLimit: 2,
        circuitBreakerEnabled: true,
        auditEnabled: true
      },
      providerCredentialSets: this.providers,
      credentialFiles: this.credentialFiles,
      quotas: this.quotas
    };
  }
  listProviders(): GatewayProviderCredentialSet[] {
    return this.providers;
  }
  listCredentialFiles(): GatewayCredentialFile[] {
    return this.credentialFiles;
  }
  listQuotas(): GatewayQuota[] {
    return this.quotas;
  }
  listLogs(limit = 50): GatewayLogListResponse {
    const items: GatewayLogEntry[] = [
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
    return { items: items.slice(0, this.limit(limit)) };
  }
  listUsage(limit = 50): GatewayUsageListResponse {
    const items: GatewayUsageRecord[] = [
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
    return { items: items.slice(0, this.limit(limit)) };
  }
  probe(request: GatewayProbeRequest): GatewayProbeResponse {
    return {
      providerId: request.providerId,
      ok: true,
      latencyMs: 620,
      inputTokens: this.countTokens(request.prompt).tokens,
      outputTokens: 16,
      message: '探测完成，通道可用'
    };
  }
  countTokens(text: string): GatewayTokenCountResponse {
    return { tokens: text.trim() ? Math.ceil(text.trim().length / 4) : 0, method: 'approximate' };
  }
  preprocess(request: GatewayPreprocessRequest): GatewayPreprocessResponse {
    const normalizedPrompt = request.prompt.trim().replace(/\s+/g, ' ');
    return {
      normalizedPrompt,
      inputTokens: this.countTokens(normalizedPrompt).tokens,
      warnings: normalizedPrompt ? [] : ['输入为空']
    };
  }
  accounting(request: GatewayAccountingRequest): GatewayAccountingResponse {
    const inputTokens = this.countTokens(request.inputText).tokens;
    const outputTokens = this.countTokens(request.outputText).tokens;
    return { providerId: request.providerId, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
  }
  private limit(limit: number): number {
    return Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 50;
  }
}
