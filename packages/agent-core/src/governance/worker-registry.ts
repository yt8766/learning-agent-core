import { WorkerDefinition } from '@agent/shared';

const DEFAULT_WORKERS: WorkerDefinition[] = [
  {
    id: 'libu-router-core',
    ministry: 'libu-router',
    displayName: '吏部路由中枢',
    defaultModel: 'glm-5',
    supportedCapabilities: ['workflow-routing', 'context-budgeting', 'model-selection'],
    reviewPolicy: 'none'
  },
  {
    id: 'hubu-search-core',
    ministry: 'hubu-search',
    displayName: '户部检索官',
    defaultModel: 'glm-4.7-flashx',
    supportedCapabilities: ['search_memory', 'read_local_file', 'list_directory', 'knowledge-synthesis'],
    reviewPolicy: 'self-check'
  },
  {
    id: 'libu-docs-core',
    ministry: 'libu-docs',
    displayName: '礼部文书官',
    defaultModel: 'glm-5',
    supportedCapabilities: ['read_local_file', 'list_directory', 'documentation', 'ui-spec'],
    reviewPolicy: 'self-check'
  },
  {
    id: 'bingbu-ops-core',
    ministry: 'bingbu-ops',
    displayName: '兵部沙盒官',
    defaultModel: 'glm-4.6',
    supportedCapabilities: ['terminal', 'sandbox', 'http_request', 'release-ops'],
    reviewPolicy: 'mandatory-xingbu'
  },
  {
    id: 'xingbu-review-core',
    ministry: 'xingbu-review',
    displayName: '刑部审计官',
    defaultModel: 'glm-4.7',
    supportedCapabilities: ['review', 'security-scan', 'compliance'],
    reviewPolicy: 'none'
  },
  {
    id: 'gongbu-code-core',
    ministry: 'gongbu-code',
    displayName: '工部营造官',
    defaultModel: 'glm-4.6',
    supportedCapabilities: ['read_local_file', 'list_directory', 'write_local_file', 'code-generation', 'refactor'],
    reviewPolicy: 'mandatory-xingbu'
  }
];

export class WorkerRegistry {
  private readonly workers = new Map<string, WorkerDefinition>();

  constructor(seedWorkers: WorkerDefinition[] = DEFAULT_WORKERS) {
    seedWorkers.forEach(worker => this.register(worker));
  }

  register(worker: WorkerDefinition): void {
    this.workers.set(worker.id, worker);
  }

  get(workerId: string): WorkerDefinition | undefined {
    return this.workers.get(workerId);
  }

  list(): WorkerDefinition[] {
    return Array.from(this.workers.values());
  }

  listByMinistry(ministry: WorkerDefinition['ministry']): WorkerDefinition[] {
    return this.list().filter(worker => worker.ministry === ministry);
  }

  getPrimaryWorker(ministry: WorkerDefinition['ministry']): WorkerDefinition | undefined {
    return this.listByMinistry(ministry)[0];
  }
}

export function createDefaultWorkerRegistry(): WorkerRegistry {
  return new WorkerRegistry(DEFAULT_WORKERS);
}
