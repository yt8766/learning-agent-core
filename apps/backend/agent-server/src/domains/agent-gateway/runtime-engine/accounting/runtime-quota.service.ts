import { Injectable } from '@nestjs/common';
import type { GatewayRuntimeHealthResponse, GatewayRuntimeQuotaPolicy } from '@agent/core';

export class RuntimeQuotaExceededError extends Error {
  readonly code = 'quota_exceeded' as const;
  readonly type = 'rate_limit_error' as const;

  constructor(message = 'Gateway quota exceeded') {
    super(message);
    this.name = 'RuntimeQuotaExceededError';
  }
}

interface RuntimeQuotaUsageKey {
  subjectType: 'user' | 'client' | 'apiKey';
  subjectId: string;
}

interface RuntimeQuotaConsumeRequest extends RuntimeQuotaUsageKey {
  tokens: number;
  requests: number;
}

interface RuntimeQuotaPrecheckRequest extends RuntimeQuotaUsageKey {
  estimatedTokens: number;
  estimatedRequests: number;
}

@Injectable()
export class RuntimeQuotaService {
  private readonly policies = new Map<string, GatewayRuntimeQuotaPolicy>();
  private readonly usage = new Map<string, { tokens: number; requests: number }>();
  private readonly cooldowns = new Map<string, GatewayRuntimeHealthResponse['cooldowns'][number]>();

  setPolicy(policy: GatewayRuntimeQuotaPolicy): void {
    this.policies.set(keyOf(policy), policy);
  }

  precheck(request: RuntimeQuotaPrecheckRequest): void {
    const key = keyOf(request);
    const policy = this.policies.get(key);
    if (!policy) return;

    const current = this.usage.get(key) ?? { tokens: 0, requests: 0 };
    const nextTokens = current.tokens + request.estimatedTokens;
    const nextRequests = current.requests + request.estimatedRequests;
    const exceeded =
      (policy.maxTokens && nextTokens > policy.maxTokens) || (policy.maxRequests && nextRequests > policy.maxRequests);
    if (policy.action === 'deny' && exceeded) {
      this.cooldowns.set(key, {
        subjectType: request.subjectType,
        subjectId: request.subjectId,
        reason: 'quota_exceeded',
        recordedAt: new Date().toISOString()
      });
      throw new RuntimeQuotaExceededError();
    }
  }

  consume(request: RuntimeQuotaConsumeRequest): void {
    const key = keyOf(request);
    const current = this.usage.get(key) ?? { tokens: 0, requests: 0 };
    this.usage.set(key, {
      tokens: current.tokens + request.tokens,
      requests: current.requests + request.requests
    });
  }

  refund(request: RuntimeQuotaConsumeRequest): void {
    const key = keyOf(request);
    const current = this.usage.get(key) ?? { tokens: 0, requests: 0 };
    this.usage.set(key, {
      tokens: Math.max(0, current.tokens - request.tokens),
      requests: Math.max(0, current.requests - request.requests)
    });
  }

  snapshotCooldowns(): GatewayRuntimeHealthResponse['cooldowns'] {
    return [...this.cooldowns.values()];
  }
}

function keyOf(value: RuntimeQuotaUsageKey): string {
  return `${value.subjectType}:${value.subjectId}`;
}
