import type { RoutingPolicyRecord } from '@agent/config';
import type { ModelRouteDecision, WorkerDomain } from '@agent/core';

import { isFreshnessSensitiveGoal } from '../utils/prompts/temporal-context';
import { WorkerRegistry, WorkerSelectionConstraints } from './worker-registry';

type AgentModelRole = 'manager' | 'research' | 'executor' | 'reviewer';

const MINISTRY_ROLE_MAP: Record<WorkerDomain, AgentModelRole> = {
  'libu-governance': 'manager',
  'hubu-search': 'research',
  'libu-delivery': 'manager',
  'bingbu-ops': 'executor',
  'xingbu-review': 'reviewer',
  'gongbu-code': 'executor',
  'libu-router': 'manager',
  'libu-docs': 'manager'
};

export class ModelRoutingPolicy {
  constructor(
    private readonly workerRegistry: WorkerRegistry,
    private readonly routing: Partial<Record<AgentModelRole, RoutingPolicyRecord>> = {}
  ) {}

  resolveRoute(
    ministry: WorkerDomain,
    goal: string,
    constraints?: WorkerSelectionConstraints,
    preferredModelId?: string
  ): ModelRouteDecision | undefined {
    const worker = this.workerRegistry.getPrimaryWorker(ministry, goal, constraints);
    if (!worker) {
      return undefined;
    }

    const lowered = goal.toLowerCase();
    const freshnessSensitive = isFreshnessSensitiveGoal(goal);
    const roleRouteModel = this.routing[MINISTRY_ROLE_MAP[ministry]]?.primary;
    const selectedModel = preferredModelId
      ? preferredModelId
      : roleRouteModel
        ? roleRouteModel
        : ministry === 'xingbu-review'
          ? 'glm-4.7'
          : ministry === 'hubu-search' && (freshnessSensitive || lowered.includes('文档'))
            ? 'glm-4.7-flashx'
            : ministry === 'bingbu-ops' && (lowered.includes('发布') || lowered.includes('deploy'))
              ? 'glm-5'
              : worker.defaultModel;

    return {
      ministry,
      workerId: worker.id,
      defaultModel: worker.defaultModel,
      selectedModel,
      reason: preferredModelId
        ? `按用户显式指定覆盖为 ${preferredModelId}`
        : roleRouteModel
          ? `按当前角色模型路由选择 ${roleRouteModel}`
          : selectedModel === worker.defaultModel
            ? `使用 ${worker.displayName} 的默认模型`
            : `按任务特征覆盖 ${worker.displayName} 的默认模型`
    };
  }
}
