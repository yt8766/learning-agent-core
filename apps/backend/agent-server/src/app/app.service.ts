import { Injectable } from '@nestjs/common';

import { HealthCheckResult } from '@agent/shared';

import { RuntimeTaskService } from '../runtime/services/runtime-task.service';

@Injectable()
export class AppService {
  constructor(private readonly runtimeTaskService: RuntimeTaskService) {}

  health(): HealthCheckResult {
    return {
      status: 'ok',
      service: 'server',
      now: new Date().toISOString()
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
