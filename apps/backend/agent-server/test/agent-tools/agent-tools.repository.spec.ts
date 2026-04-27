import { ChatEventRecordSchema, ExecutionRequestRecordSchema, ExecutionResultRecordSchema } from '@agent/core';
import { describe, expect, it } from 'vitest';

import { AgentToolsRepository } from '../../src/agent-tools/agent-tools.repository';
import { AgentToolsService } from '../../src/agent-tools/agent-tools.service';

describe('AgentToolsRepository', () => {
  it('round-trips requests, results, events and approval projections through a contract snapshot', () => {
    const sourceRepository = new AgentToolsRepository();
    const sourceService = new AgentToolsService(sourceRepository);
    const succeeded = sourceService.createRequest({
      taskId: 'task-snapshot-low',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime', actorId: 'runtime-snapshot' },
      input: { path: 'README.md' },
      riskClass: 'low'
    });
    const pending = sourceService.createRequest({
      taskId: 'task-snapshot-approval',
      capabilityId: 'capability.mcp.run_terminal',
      toolName: 'run_terminal',
      requestedBy: { actor: 'supervisor' },
      input: { command: 'pnpm verify' },
      riskClass: 'high'
    });

    const snapshot = sourceRepository.exportSnapshot();
    const restoredRepository = new AgentToolsRepository();
    restoredRepository.restoreSnapshot(snapshot);

    expect(snapshot).toEqual({
      requests: [succeeded.request, pending.request],
      results: [succeeded.result],
      events: sourceService.listEvents(),
      approvals: [{ requestId: pending.request.requestId, approval: pending.approval }]
    });
    expect(snapshot.requests).not.toBe(sourceRepository.listRequests());
    expect(snapshot.events).not.toBe(sourceRepository.listEvents());
    expect(() => ExecutionRequestRecordSchema.array().parse(snapshot.requests)).not.toThrow();
    expect(() => ExecutionResultRecordSchema.array().parse(snapshot.results)).not.toThrow();
    expect(() => ChatEventRecordSchema.array().parse(snapshot.events)).not.toThrow();
    expect(restoredRepository.listRequests()).toEqual(sourceRepository.listRequests());
    expect(restoredRepository.listResults()).toEqual(sourceRepository.listResults());
    expect(restoredRepository.listEvents()).toEqual(sourceRepository.listEvents());
    expect(restoredRepository.getStoredRequest(pending.request.requestId)?.approval).toEqual(pending.approval);
  });

  it('rebuilds the requestId event index when restoring a snapshot', () => {
    const sourceRepository = new AgentToolsRepository();
    const sourceService = new AgentToolsService(sourceRepository);
    const first = sourceService.createRequest({
      taskId: 'task-events-first',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime' },
      input: { path: 'README.md' },
      riskClass: 'low'
    });
    const second = sourceService.createRequest({
      taskId: 'task-events-second',
      capabilityId: 'capability.mcp.run_terminal',
      toolName: 'run_terminal',
      requestedBy: { actor: 'supervisor' },
      input: { command: 'pnpm test' },
      riskClass: 'high'
    });

    const restoredRepository = new AgentToolsRepository();
    restoredRepository.restoreSnapshot(sourceRepository.exportSnapshot());

    expect(restoredRepository.listEvents(first.request.requestId)).toEqual(
      sourceService.listEvents(first.request.requestId)
    );
    expect(restoredRepository.listEvents(second.request.requestId)).toEqual(
      sourceService.listEvents(second.request.requestId)
    );
    expect(restoredRepository.listEvents('missing-request')).toEqual([]);
  });
});
