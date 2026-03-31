import { RuntimeSessionService } from './runtime-session.service';
import { RuntimeTaskService } from './runtime-task.service';

export interface RuntimeMessageGatewayFacade {
  listSessions: RuntimeSessionService['listSessions'];
  createSession: RuntimeSessionService['createSession'];
  appendSessionMessage: RuntimeSessionService['appendSessionMessage'];
  getSessionCheckpoint: RuntimeSessionService['getSessionCheckpoint'];
  getSession: RuntimeSessionService['getSession'];
  listSessionMessages: RuntimeSessionService['listSessionMessages'];
  getTask: RuntimeTaskService['getTask'];
  approveTaskAction: RuntimeTaskService['approveTaskAction'];
  rejectTaskAction: RuntimeTaskService['rejectTaskAction'];
  recoverSessionToCheckpoint: RuntimeSessionService['recoverSessionToCheckpoint'];
}

export class RuntimeMessageGatewayFacadeService implements RuntimeMessageGatewayFacade {
  constructor(
    private readonly runtimeSessionService: RuntimeSessionService,
    private readonly runtimeTaskService: RuntimeTaskService
  ) {}

  listSessions() {
    return this.runtimeSessionService.listSessions();
  }

  createSession(...args: Parameters<RuntimeSessionService['createSession']>) {
    return this.runtimeSessionService.createSession(...args);
  }

  appendSessionMessage(...args: Parameters<RuntimeSessionService['appendSessionMessage']>) {
    return this.runtimeSessionService.appendSessionMessage(...args);
  }

  getSessionCheckpoint(...args: Parameters<RuntimeSessionService['getSessionCheckpoint']>) {
    return this.runtimeSessionService.getSessionCheckpoint(...args);
  }

  getSession(...args: Parameters<RuntimeSessionService['getSession']>) {
    return this.runtimeSessionService.getSession(...args);
  }

  listSessionMessages(...args: Parameters<RuntimeSessionService['listSessionMessages']>) {
    return this.runtimeSessionService.listSessionMessages(...args);
  }

  getTask(...args: Parameters<RuntimeTaskService['getTask']>) {
    return this.runtimeTaskService.getTask(...args);
  }

  approveTaskAction(...args: Parameters<RuntimeTaskService['approveTaskAction']>) {
    return this.runtimeTaskService.approveTaskAction(...args);
  }

  rejectTaskAction(...args: Parameters<RuntimeTaskService['rejectTaskAction']>) {
    return this.runtimeTaskService.rejectTaskAction(...args);
  }

  recoverSessionToCheckpoint(...args: Parameters<RuntimeSessionService['recoverSessionToCheckpoint']>) {
    return this.runtimeSessionService.recoverSessionToCheckpoint(...args);
  }
}
