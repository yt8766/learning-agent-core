import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';

import { SandboxController } from '../../src/sandbox/sandbox.controller';

describe('SandboxController', () => {
  it('uses the route prefix that composes with the global api prefix once', () => {
    expect(Reflect.getMetadata(PATH_METADATA, SandboxController)).toBe('sandbox');
  });

  it('exposes the REST facade paths documented by the Sandbox API', () => {
    expectRoute('listProfiles', RequestMethod.GET, 'profiles');
    expectRoute('preflight', RequestMethod.POST, 'preflight');
    expectRoute('executeCommand', RequestMethod.POST, 'execute');
    expectRoute('getRun', RequestMethod.GET, 'runs/:runId');
    expectRoute('cancelRun', RequestMethod.POST, 'runs/:runId/cancel');
    expectRoute('resumeApproval', RequestMethod.POST, 'runs/:runId/approval');
  });

  it('delegates sandbox facade routes to the service', () => {
    const service = {
      listProfiles: vi.fn(() => [{ profile: 'workspace-write' }]),
      preflight: vi.fn(() => ({ decision: 'allow' })),
      executeCommand: vi.fn(() => ({ runId: 'sandbox-run-execute', status: 'passed' })),
      getRun: vi.fn(() => ({ runId: 'sandbox-run-1' })),
      cancelRun: vi.fn(() => ({ runId: 'sandbox-run-1', status: 'cancelled' })),
      resumeApproval: vi.fn(() => ({ runId: 'sandbox-run-1', status: 'passed' }))
    };
    const controller = new SandboxController(service as never);

    expect(controller.listProfiles()).toEqual([{ profile: 'workspace-write' }]);
    expect(controller.preflight({ taskId: 'task-1' })).toEqual({ decision: 'allow' });
    expect(controller.executeCommand({ taskId: 'task-execute', command: 'pwd' })).toEqual({
      runId: 'sandbox-run-execute',
      status: 'passed'
    });
    expect(controller.getRun('sandbox-run-1')).toEqual({ runId: 'sandbox-run-1' });
    expect(controller.cancelRun('sandbox-run-1', { actor: 'human' })).toEqual({
      runId: 'sandbox-run-1',
      status: 'cancelled'
    });
    expect(
      controller.resumeApproval('sandbox-run-1', {
        sessionId: 'session-1',
        interrupt: { action: 'approve', runId: 'sandbox-run-1' }
      })
    ).toEqual({ runId: 'sandbox-run-1', status: 'passed' });

    expect(service.listProfiles).toHaveBeenCalledWith();
    expect(service.preflight).toHaveBeenCalledWith({ taskId: 'task-1' });
    expect(service.executeCommand).toHaveBeenCalledWith({ taskId: 'task-execute', command: 'pwd' });
    expect(service.getRun).toHaveBeenCalledWith('sandbox-run-1');
    expect(service.cancelRun).toHaveBeenCalledWith('sandbox-run-1', { actor: 'human' });
    expect(service.resumeApproval).toHaveBeenCalledWith('sandbox-run-1', {
      sessionId: 'session-1',
      interrupt: { action: 'approve', runId: 'sandbox-run-1' }
    });
  });
});

function expectRoute(methodName: keyof SandboxController, method: RequestMethod, path: string): void {
  const handler = SandboxController.prototype[methodName];
  expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
  expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
}
