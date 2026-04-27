import { Injectable } from '@nestjs/common';
import {
  ChatEventRecordSchema,
  ExecutionRequestRecordSchema,
  ExecutionResultRecordSchema,
  type ChatEventRecord,
  type ExecutionRequestRecord,
  type ExecutionResultRecord
} from '@agent/core';

import type {
  AgentToolApprovalProjection,
  AgentToolStoredRequest,
  AgentToolsRepositorySnapshot,
  AgentToolsRepositoryStore
} from './agent-tools.types';

@Injectable()
export class AgentToolsRepository implements AgentToolsRepositoryStore {
  private readonly requests = new Map<string, AgentToolStoredRequest>();
  private readonly resultsByRequestId = new Map<string, ExecutionResultRecord>();
  private readonly events: ChatEventRecord[] = [];
  private readonly eventsByRequestId = new Map<string, ChatEventRecord[]>();

  saveRequest(request: ExecutionRequestRecord, approval?: AgentToolApprovalProjection): ExecutionRequestRecord {
    const existing = this.requests.get(request.requestId);
    this.requests.set(request.requestId, {
      request,
      result: existing?.result,
      approval
    });
    return request;
  }

  saveResult(result: ExecutionResultRecord): ExecutionResultRecord {
    const existing = this.requests.get(result.requestId);
    if (existing) {
      this.requests.set(result.requestId, { ...existing, result, approval: undefined });
    }
    this.resultsByRequestId.set(result.requestId, result);
    return result;
  }

  appendEvents(requestId: string, events: ChatEventRecord[]): ChatEventRecord[] {
    if (events.length === 0) {
      return this.eventsByRequestId.get(requestId) ?? [];
    }
    this.events.push(...events);
    const existing = this.eventsByRequestId.get(requestId) ?? [];
    const next = [...existing, ...events];
    this.eventsByRequestId.set(requestId, next);
    return next;
  }

  getStoredRequest(requestId: string): AgentToolStoredRequest | undefined {
    return this.requests.get(requestId);
  }

  getRequest(requestId: string): ExecutionRequestRecord | undefined {
    return this.requests.get(requestId)?.request;
  }

  getResult(requestId: string): ExecutionResultRecord | undefined {
    return this.resultsByRequestId.get(requestId);
  }

  listRequests(): ExecutionRequestRecord[] {
    return [...this.requests.values()].map(stored => stored.request);
  }

  listResults(): ExecutionResultRecord[] {
    return [...this.resultsByRequestId.values()];
  }

  listEvents(requestId?: string): ChatEventRecord[] {
    return requestId ? [...(this.eventsByRequestId.get(requestId) ?? [])] : [...this.events];
  }

  exportSnapshot(): AgentToolsRepositorySnapshot {
    return {
      requests: ExecutionRequestRecordSchema.array().parse(this.listRequests()),
      results: ExecutionResultRecordSchema.array().parse(this.listResults()),
      events: ChatEventRecordSchema.array().parse(this.listEvents()),
      approvals: [...this.requests.entries()].flatMap(([requestId, stored]) =>
        stored.approval ? [{ requestId, approval: cloneApprovalProjection(stored.approval) }] : []
      )
    };
  }

  restoreSnapshot(snapshot: AgentToolsRepositorySnapshot): void {
    const requests = ExecutionRequestRecordSchema.array().parse(snapshot.requests);
    const results = ExecutionResultRecordSchema.array().parse(snapshot.results);
    const events = ChatEventRecordSchema.array().parse(snapshot.events);
    const approvalsByRequestId = new Map(
      snapshot.approvals.map(item => [item.requestId, cloneApprovalProjection(item.approval)])
    );
    const resultsByRequestId = new Map(results.map(result => [result.requestId, result]));

    this.requests.clear();
    this.resultsByRequestId.clear();
    this.events.splice(0, this.events.length);
    this.eventsByRequestId.clear();

    for (const request of requests) {
      this.requests.set(request.requestId, {
        request,
        result: resultsByRequestId.get(request.requestId),
        approval: approvalsByRequestId.get(request.requestId)
      });
    }
    for (const result of results) {
      this.resultsByRequestId.set(result.requestId, result);
    }
    this.events.push(...events);
    for (const event of events) {
      const requestId = event.payload.requestId;
      if (typeof requestId !== 'string') {
        continue;
      }
      const existing = this.eventsByRequestId.get(requestId) ?? [];
      this.eventsByRequestId.set(requestId, [...existing, event]);
    }
  }
}

function cloneApprovalProjection(approval: AgentToolApprovalProjection): AgentToolApprovalProjection {
  return {
    ...approval,
    resumePayload: { ...approval.resumePayload }
  };
}
