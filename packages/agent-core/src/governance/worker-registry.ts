import { RuntimeProfile, WorkerDefinition } from '@agent/shared';

import { describeWorkerProfilePolicy } from './profile-policy';

const DEFAULT_WORKERS: WorkerDefinition[] = [
  {
    id: 'libu-router-core',
    ministry: 'libu-router',
    kind: 'core',
    displayName: '吏部路由中枢',
    defaultModel: 'glm-5',
    supportedCapabilities: ['workflow-routing', 'context-budgeting', 'model-selection'],
    reviewPolicy: 'none',
    tags: ['routing', 'budget', 'supervisor']
  },
  {
    id: 'hubu-search-core',
    ministry: 'hubu-search',
    kind: 'core',
    displayName: '户部检索官',
    defaultModel: 'glm-4.7-flashx',
    supportedCapabilities: ['search_memory', 'read_local_file', 'list_directory', 'knowledge-synthesis'],
    reviewPolicy: 'self-check',
    tags: ['research', 'memory', 'knowledge']
  },
  {
    id: 'libu-docs-core',
    ministry: 'libu-docs',
    kind: 'core',
    displayName: '礼部文书官',
    defaultModel: 'glm-5',
    supportedCapabilities: ['read_local_file', 'list_directory', 'documentation', 'ui-spec'],
    reviewPolicy: 'self-check',
    tags: ['documentation', 'delivery']
  },
  {
    id: 'bingbu-ops-core',
    ministry: 'bingbu-ops',
    kind: 'core',
    displayName: '兵部沙盒官',
    defaultModel: 'glm-4.6',
    supportedCapabilities: ['terminal', 'sandbox', 'http_request', 'release-ops'],
    reviewPolicy: 'mandatory-xingbu',
    tags: ['terminal', 'sandbox', 'release']
  },
  {
    id: 'xingbu-review-core',
    ministry: 'xingbu-review',
    kind: 'core',
    displayName: '刑部审计官',
    defaultModel: 'glm-4.7',
    supportedCapabilities: ['review', 'security-scan', 'compliance'],
    reviewPolicy: 'none',
    tags: ['review', 'security', 'compliance']
  },
  {
    id: 'gongbu-code-core',
    ministry: 'gongbu-code',
    kind: 'core',
    displayName: '工部营造官',
    defaultModel: 'glm-4.6',
    supportedCapabilities: ['read_local_file', 'list_directory', 'write_local_file', 'code-generation', 'refactor'],
    reviewPolicy: 'mandatory-xingbu',
    tags: ['code', 'refactor']
  },
  {
    id: 'hubu-search-internal-wiki',
    ministry: 'hubu-search',
    kind: 'company',
    displayName: '户部内网知识官',
    defaultModel: 'glm-4.7-flashx',
    supportedCapabilities: ['knowledge-synthesis', 'search_memory', 'read_local_file'],
    reviewPolicy: 'self-check',
    sourceId: 'internal-knowledge',
    owner: 'company',
    tags: ['company', 'wiki', 'knowledge'],
    requiredConnectors: ['internal-knowledge-base']
  },
  {
    id: 'hubu-search-feishu',
    ministry: 'hubu-search',
    kind: 'company',
    displayName: '户部飞书检索官',
    defaultModel: 'glm-4.7-flashx',
    supportedCapabilities: ['knowledge-synthesis', 'search_memory'],
    reviewPolicy: 'self-check',
    sourceId: 'feishu-knowledge',
    owner: 'company',
    tags: ['company', 'feishu', 'knowledge'],
    requiredConnectors: ['feishu']
  },
  {
    id: 'gongbu-code-frontend',
    ministry: 'gongbu-code',
    kind: 'company',
    displayName: '工部前端营造官',
    defaultModel: 'glm-4.6',
    supportedCapabilities: ['read_local_file', 'write_local_file', 'code-generation', 'refactor'],
    reviewPolicy: 'mandatory-xingbu',
    sourceId: 'company-frontend-standards',
    owner: 'frontend-team',
    tags: ['company', 'frontend', 'react'],
    requiredConnectors: ['repo']
  },
  {
    id: 'gongbu-code-service',
    ministry: 'gongbu-code',
    kind: 'company',
    displayName: '工部服务端营造官',
    defaultModel: 'glm-4.6',
    supportedCapabilities: ['read_local_file', 'write_local_file', 'code-generation', 'refactor'],
    reviewPolicy: 'mandatory-xingbu',
    sourceId: 'company-service-standards',
    owner: 'backend-team',
    tags: ['company', 'service', 'nestjs'],
    requiredConnectors: ['repo']
  },
  {
    id: 'bingbu-ops-ci',
    ministry: 'bingbu-ops',
    kind: 'company',
    displayName: '兵部 CI 巡检官',
    defaultModel: 'glm-4.6',
    supportedCapabilities: ['terminal', 'sandbox', 'release-ops'],
    reviewPolicy: 'mandatory-xingbu',
    sourceId: 'company-ci',
    owner: 'platform-team',
    tags: ['company', 'ci', 'pipeline'],
    requiredConnectors: ['ci']
  },
  {
    id: 'bingbu-ops-browser',
    ministry: 'bingbu-ops',
    kind: 'company',
    displayName: '兵部浏览器行动官',
    defaultModel: 'glm-4.6',
    supportedCapabilities: ['terminal', 'sandbox', 'http_request', 'release-ops'],
    reviewPolicy: 'mandatory-xingbu',
    sourceId: 'company-browser',
    owner: 'platform-team',
    tags: ['company', 'browser', 'qa'],
    requiredConnectors: ['browser']
  },
  {
    id: 'xingbu-review-security',
    ministry: 'xingbu-review',
    kind: 'company',
    displayName: '刑部安全审计官',
    defaultModel: 'glm-4.7',
    supportedCapabilities: ['review', 'security-scan', 'compliance'],
    reviewPolicy: 'none',
    sourceId: 'company-security',
    owner: 'security-team',
    tags: ['company', 'security', 'review'],
    requiredConnectors: ['security-scan']
  },
  {
    id: 'libu-docs-openapi',
    ministry: 'libu-docs',
    kind: 'company',
    displayName: '礼部 OpenAPI 文书官',
    defaultModel: 'glm-5',
    supportedCapabilities: ['documentation', 'ui-spec', 'read_local_file'],
    reviewPolicy: 'self-check',
    sourceId: 'company-openapi',
    owner: 'platform-team',
    tags: ['company', 'openapi', 'docs'],
    requiredConnectors: ['repo']
  }
];

export class WorkerRegistry {
  private readonly workers = new Map<string, WorkerDefinition>();
  private readonly disabledWorkerIds = new Set<string>();

  constructor(seedWorkers: WorkerDefinition[] = DEFAULT_WORKERS) {
    seedWorkers.forEach(worker => this.register(worker));
  }

  register(worker: WorkerDefinition): void {
    this.workers.set(worker.id, worker);
  }

  registerMany(workers: WorkerDefinition[]): void {
    workers.forEach(worker => this.register(worker));
  }

  get(workerId: string): WorkerDefinition | undefined {
    return this.workers.get(workerId);
  }

  setEnabled(workerId: string, enabled: boolean): void {
    if (!this.workers.has(workerId)) {
      return;
    }
    if (enabled) {
      this.disabledWorkerIds.delete(workerId);
      return;
    }
    this.disabledWorkerIds.add(workerId);
  }

  isEnabled(workerId: string): boolean {
    return !this.disabledWorkerIds.has(workerId);
  }

  list(): WorkerDefinition[] {
    return Array.from(this.workers.values());
  }

  listByMinistry(ministry: WorkerDefinition['ministry']): WorkerDefinition[] {
    return this.list().filter(worker => worker.ministry === ministry);
  }

  getPrimaryWorker(
    ministry: WorkerDefinition['ministry'],
    goal?: string,
    constraints?: WorkerSelectionConstraints
  ): WorkerDefinition | undefined {
    return this.selectBestWorker(ministry, goal, constraints);
  }

  private selectBestWorker(
    ministry: WorkerDefinition['ministry'],
    goal?: string,
    constraints?: WorkerSelectionConstraints
  ): WorkerDefinition | undefined {
    const loweredGoal = goal?.toLowerCase() ?? '';
    return this.listByMinistry(ministry)
      .filter(worker => this.isAvailable(worker, constraints))
      .map(worker => ({
        worker,
        score: this.scoreWorker(worker, loweredGoal)
      }))
      .sort((left, right) => right.score - left.score)[0]?.worker;
  }

  private isAvailable(worker: WorkerDefinition, constraints?: WorkerSelectionConstraints): boolean {
    if (!this.isEnabled(worker.id)) {
      return false;
    }

    if (constraints?.profile) {
      const profilePolicy = describeWorkerProfilePolicy(worker, constraints.profile);
      if (!profilePolicy.enabledByProfile) {
        return false;
      }
    }

    if ((worker.requiredConnectors?.length ?? 0) > 0 && (constraints?.disallowedConnectorIds?.length ?? 0) > 0) {
      const disallowed = new Set(constraints?.disallowedConnectorIds ?? []);
      if ((worker.requiredConnectors ?? []).some(connectorId => disallowed.has(connectorId))) {
        return false;
      }
    }

    return true;
  }

  private scoreWorker(worker: WorkerDefinition, loweredGoal: string): number {
    let score = worker.kind === 'installed-skill' ? 40 : worker.kind === 'company' ? 25 : 10;

    for (const tag of worker.tags ?? []) {
      if (loweredGoal.includes(tag.toLowerCase())) {
        score += 8;
      }
    }

    for (const context of worker.preferredContexts ?? []) {
      if (loweredGoal.includes(context.toLowerCase())) {
        score += 12;
      }
    }

    for (const connector of worker.requiredConnectors ?? []) {
      if (loweredGoal.includes(connector.toLowerCase())) {
        score += 6;
      }
    }

    if (worker.id.includes('browser') && (loweredGoal.includes('browse') || loweredGoal.includes('浏览器'))) {
      score += 16;
    }
    if (worker.id.includes('ci') && (loweredGoal.includes('ci') || loweredGoal.includes('测试'))) {
      score += 16;
    }
    if (worker.id.includes('frontend') && (loweredGoal.includes('frontend') || loweredGoal.includes('react'))) {
      score += 16;
    }
    if (worker.id.includes('service') && (loweredGoal.includes('service') || loweredGoal.includes('nestjs'))) {
      score += 16;
    }

    return score;
  }
}

export interface WorkerSelectionConstraints {
  profile?: RuntimeProfile;
  disallowedConnectorIds?: string[];
}

export function createDefaultWorkerRegistry(): WorkerRegistry {
  return new WorkerRegistry(DEFAULT_WORKERS);
}
