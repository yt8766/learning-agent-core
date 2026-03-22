import { Injectable } from '@nestjs/common';

import { HealthCheckResult } from '@agent/shared';

import { RuntimeService } from '../runtime/runtime.service';

@Injectable()
export class AppService {
  constructor(private readonly runtimeService: RuntimeService) {}

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
      graph: this.runtimeService.describeGraph(),
      approvalPolicy: 'write operations and external requests require approval'
    };
  }
}
