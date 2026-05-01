import { Injectable } from '@nestjs/common';

import { HealthCheckResult } from '@agent/core';

import { RuntimeHost } from '../runtime/core/runtime.host';
import { RuntimeTaskService } from '../runtime/services/runtime-task.service';

type AppHealthCheckResult = HealthCheckResult & {
  knowledgeSearchStatus: RuntimeHost['knowledgeSearchStatus'];
};

@Injectable()
export class AppService {
  constructor(
    private readonly runtimeTaskService: RuntimeTaskService,
    private readonly runtimeHost: RuntimeHost
  ) {}

  async health(): Promise<AppHealthCheckResult> {
    return {
      status: 'ok',
      service: 'server',
      now: new Date().toISOString(),
      knowledgeSearchStatus: await this.runtimeHost.getKnowledgeSearchStatus()
    };
  }

  demo() {
    return {
      message: 'AI agent server is ready',
      graph: this.runtimeTaskService.describeGraph(),
      approvalPolicy: 'write operations and external requests require approval'
    };
  }
}
