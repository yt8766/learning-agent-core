import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';

import { RuntimeHost } from '../core/runtime.host';
import { createIntelScheduler } from './intel-scheduler';

interface BreeLike {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface RuntimeIntelSchedulerServiceOptions {
  env?: Record<string, string | undefined>;
  createScheduler?: typeof createIntelScheduler;
}

export const RUNTIME_INTEL_SCHEDULER_OPTIONS = Symbol('RUNTIME_INTEL_SCHEDULER_OPTIONS');

@Injectable()
export class RuntimeIntelSchedulerService implements OnModuleInit, OnModuleDestroy {
  private scheduler?: BreeLike;

  constructor(
    @Inject(RuntimeHost) private readonly runtimeHost: Pick<RuntimeHost, 'settings'>,
    @Optional()
    @Inject(RUNTIME_INTEL_SCHEDULER_OPTIONS)
    private readonly options: RuntimeIntelSchedulerServiceOptions = {}
  ) {}

  async onModuleInit() {
    if (!this.isEnabled()) {
      return;
    }

    const schedulerFactory = this.options.createScheduler ?? createIntelScheduler;
    this.scheduler = schedulerFactory({
      workspaceRoot: this.runtimeHost.settings.workspaceRoot
    }) as BreeLike;
    await this.scheduler.start();
  }

  async onModuleDestroy() {
    if (!this.scheduler) {
      return;
    }
    await this.scheduler.stop().catch(() => undefined);
  }

  private isEnabled() {
    return String((this.options.env ?? process.env).INTEL_SCHEDULER_ENABLED ?? '').toLowerCase() === 'true';
  }
}
