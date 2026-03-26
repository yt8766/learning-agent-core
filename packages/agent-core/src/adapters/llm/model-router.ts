import { RoutingPolicyRecord } from '@agent/config';

import { AgentModelRole, LlmProvider } from './llm-provider';
import { ProviderRegistry } from './provider-registry';

export interface ResolvedModel {
  provider: LlmProvider;
  modelId: string;
  reason: string;
}

export interface ModelRequest {
  role: AgentModelRole;
  preferredModelId?: string;
  fallbackModelId?: string;
  overBudget?: boolean;
}

function parseProviderAndModel(value: string): { providerId: string; modelId: string } | null {
  const [providerId, modelId] = value.split('/');
  if (!providerId || !modelId) {
    return null;
  }
  return { providerId, modelId };
}

export class ModelRouter {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly routing: Partial<Record<AgentModelRole, RoutingPolicyRecord>>
  ) {}

  resolve(request: ModelRequest): ResolvedModel {
    const candidates: string[] = [];
    if (request.overBudget && request.fallbackModelId) {
      candidates.push(request.fallbackModelId);
    }
    if (request.preferredModelId) {
      candidates.push(request.preferredModelId);
    }

    const route = this.routing[request.role];
    if (route?.primary) {
      candidates.push(route.primary);
    }
    for (const fallback of route?.fallback ?? []) {
      candidates.push(fallback);
    }

    for (const candidate of candidates) {
      const parsed = parseProviderAndModel(candidate);
      if (parsed) {
        const provider = this.registry.get(parsed.providerId);
        if (!provider || !provider.isConfigured()) {
          continue;
        }
        if (provider.supportedModels().some(model => model.id === parsed.modelId)) {
          return {
            provider,
            modelId: parsed.modelId,
            reason:
              request.overBudget && request.fallbackModelId === candidate
                ? `当前任务已超预算，已降级到回退模型 ${candidate}`
                : `命中 ${request.role} 的模型路由策略`
          };
        }
      }

      const provider = this.registry.findByModel(candidate);
      if (provider?.isConfigured()) {
        return {
          provider,
          modelId: candidate,
          reason:
            request.overBudget && request.fallbackModelId === candidate
              ? `当前任务已超预算，已降级到回退模型 ${candidate}`
              : request.preferredModelId === candidate
                ? `命中显式模型偏好 ${candidate}`
                : `命中 ${request.role} 的模型路由策略`
        };
      }
    }

    const firstConfiguredProvider = this.registry.getConfiguredProviders()[0];
    if (firstConfiguredProvider) {
      const firstModel = firstConfiguredProvider.supportedModels()[0];
      if (firstModel) {
        return {
          provider: firstConfiguredProvider,
          modelId: firstModel.id,
          reason: `未命中显式路由，回退到 ${firstConfiguredProvider.displayName}`
        };
      }
    }

    throw new Error(`No configured LLM provider available for role ${request.role}.`);
  }
}
