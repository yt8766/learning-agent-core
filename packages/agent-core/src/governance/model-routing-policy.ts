import { ModelRouteDecision, WorkerDomain } from '@agent/shared';

import { WorkerRegistry } from './worker-registry';

export class ModelRoutingPolicy {
  constructor(private readonly workerRegistry: WorkerRegistry) {}

  resolveRoute(ministry: WorkerDomain, goal: string): ModelRouteDecision | undefined {
    const worker = this.workerRegistry.getPrimaryWorker(ministry);
    if (!worker) {
      return undefined;
    }

    const lowered = goal.toLowerCase();
    const selectedModel =
      ministry === 'xingbu-review'
        ? 'glm-4.7'
        : ministry === 'hubu-search' && (lowered.includes('latest') || lowered.includes('文档'))
          ? 'glm-4.7-flashx'
          : ministry === 'bingbu-ops' && (lowered.includes('发布') || lowered.includes('deploy'))
            ? 'glm-5'
            : worker.defaultModel;

    return {
      ministry,
      workerId: worker.id,
      defaultModel: worker.defaultModel,
      selectedModel,
      reason:
        selectedModel === worker.defaultModel
          ? `使用 ${worker.displayName} 的默认模型`
          : `按任务特征覆盖 ${worker.displayName} 的默认模型`
    };
  }
}
