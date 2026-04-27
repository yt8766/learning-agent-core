import type { ExecutionRequestRecord, ExecutionResultRecord, ExecutionResultStatus } from '@agent/core';
import { createExecutionResult } from '@agent/runtime';

import {
  buildExecutionStartedEventDraft,
  buildTerminalAgentToolEventDrafts,
  type AgentToolEventDraft
} from './agent-tools.events';
import { markAgentToolQueueTransition } from './agent-tools.queue';
import type { AgentToolExecutionResponse } from './agent-tools.types';

interface DrainQueuedAgentToolExecutionOptions {
  request: ExecutionRequestRecord;
  outputPreview: string;
  saveRequest(request: ExecutionRequestRecord): ExecutionRequestRecord;
  saveResult(result: ExecutionResultRecord): void;
  appendEvents(request: ExecutionRequestRecord, drafts: AgentToolEventDraft[]): void;
  buildResult(
    request: ExecutionRequestRecord,
    status: ExecutionResultStatus,
    outputPreview: string
  ): ExecutionResultRecord;
}

export function enqueueAgentToolRequest(
  request: ExecutionRequestRecord,
  saveRequest: (request: ExecutionRequestRecord) => ExecutionRequestRecord
): ExecutionRequestRecord {
  return saveRequest(
    markAgentToolQueueTransition(
      {
        ...request,
        status: 'queued'
      },
      'queued',
      new Date().toISOString()
    )
  );
}

export function drainQueuedAgentToolExecution(
  options: DrainQueuedAgentToolExecutionOptions
): AgentToolExecutionResponse {
  const startedAt = new Date().toISOString();
  const runningRequest = options.saveRequest(
    markAgentToolQueueTransition(
      {
        ...options.request,
        status: 'running',
        startedAt
      },
      'running',
      startedAt
    )
  );
  options.appendEvents(runningRequest, [buildExecutionStartedEventDraft(runningRequest)]);

  const finishedAt = new Date().toISOString();
  const succeededRequest = options.saveRequest(
    markAgentToolQueueTransition(
      {
        ...runningRequest,
        status: 'succeeded',
        finishedAt
      },
      'succeeded',
      finishedAt
    )
  );
  const result = options.buildResult(succeededRequest, 'succeeded', options.outputPreview);
  options.saveResult(result);
  options.appendEvents(
    succeededRequest,
    buildTerminalAgentToolEventDrafts(succeededRequest, 'succeeded', result.resultId, result.outputPreview)
  );
  return { request: succeededRequest, policyDecision: succeededRequest.policyDecision, result };
}

export function buildAgentToolExecutionResult(
  request: ExecutionRequestRecord,
  status: ExecutionResultStatus,
  outputPreview: string
): ExecutionResultRecord {
  return createExecutionResult({
    requestId: request.requestId,
    taskId: request.taskId,
    nodeId: request.nodeId,
    status,
    outputPreview,
    startedAt: request.startedAt,
    finishedAt: request.finishedAt,
    metadata: { capabilityId: request.capabilityId, toolName: request.toolName }
  });
}
