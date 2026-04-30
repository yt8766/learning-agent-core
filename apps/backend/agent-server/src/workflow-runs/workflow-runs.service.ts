// apps/backend/agent-server/src/workflow-runs/workflow-runs.service.ts
import { Injectable } from '@nestjs/common';
import { EMPTY, Observable, Subject, from, merge, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import type { CompanyLiveNodeTrace } from '@agent/core';

import { WorkflowRunRepository } from './repositories/workflow-run.repository';
import { WorkflowDispatcher } from './workflow-dispatcher';

export interface NodeCompleteEvent {
  type: 'node-complete';
  nodeId: string;
  status: string;
  durationMs: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface RunCompleteEvent {
  type: 'run-complete';
  runId: string;
  status: string;
  totalMs: number;
}

export interface RunErrorEvent {
  type: 'run-error';
  runId: string;
  error: string;
}

export type WorkflowStreamEvent = NodeCompleteEvent | RunCompleteEvent | RunErrorEvent;

@Injectable()
export class WorkflowRunService {
  private readonly subjects = new Map<string, Subject<WorkflowStreamEvent>>();

  constructor(
    private readonly repository: WorkflowRunRepository,
    private readonly dispatcher: WorkflowDispatcher
  ) {}

  async startRun(workflowId: string, input: Record<string, unknown>): Promise<string> {
    const runId = crypto.randomUUID();
    const subject = new Subject<WorkflowStreamEvent>();
    this.subjects.set(runId, subject);

    await this.repository.create({ id: runId, workflowId, inputData: input });

    void this.executeAsync(runId, workflowId, input, subject);

    return runId;
  }

  streamRun(runId: string): Observable<{ data: string; type: string }> {
    const subject = this.subjects.get(runId);

    if (subject) {
      return subject.asObservable().pipe(map(event => ({ data: JSON.stringify(event), type: event.type })));
    }

    // Run already finished — replay from DB
    return from(this.repository.findById(runId)).pipe(
      mergeMap(run => {
        if (!run) return EMPTY;
        const traceEvents: WorkflowStreamEvent[] = (run.traceData ?? []).map(
          (t: CompanyLiveNodeTrace) =>
            ({
              type: 'node-complete',
              nodeId: t.nodeId,
              status: t.status,
              durationMs: t.durationMs,
              input: t.inputSnapshot,
              output: t.outputSnapshot
            }) as NodeCompleteEvent
        );
        const completeEvent: WorkflowStreamEvent = {
          type: 'run-complete',
          runId,
          status: run.status,
          totalMs: run.completedAt ? run.completedAt - run.startedAt : 0
        };
        return of(...traceEvents, completeEvent);
      }),
      map(event => ({ data: JSON.stringify(event), type: event.type }))
    );
  }

  async listRuns(
    workflowId?: string
  ): Promise<Array<{ id: string; workflowId: string; status: string; startedAt: number; completedAt: number | null }>> {
    const runs = workflowId ? await this.repository.findByWorkflowId(workflowId) : await this.repository.findAll();
    return runs.map(r => ({
      id: r.id,
      workflowId: r.workflowId,
      status: r.status,
      startedAt: r.startedAt,
      completedAt: r.completedAt
    }));
  }

  async getRun(id: string) {
    return this.repository.findById(id);
  }

  private async executeAsync(
    runId: string,
    workflowId: string,
    input: Record<string, unknown>,
    subject: Subject<WorkflowStreamEvent>
  ): Promise<void> {
    const startedAt = Date.now();
    try {
      const result = await this.dispatcher.dispatch(workflowId, input, (trace: CompanyLiveNodeTrace) => {
        subject.next({
          type: 'node-complete',
          nodeId: trace.nodeId,
          status: trace.status,
          durationMs: trace.durationMs,
          input: trace.inputSnapshot,
          output: trace.outputSnapshot
        });
      });

      await this.repository.complete(runId, result.trace);

      subject.next({
        type: 'run-complete',
        runId,
        status: 'completed',
        totalMs: Date.now() - startedAt
      });
      subject.complete();
    } catch (err) {
      subject.next({
        type: 'run-error',
        runId,
        error: err instanceof Error ? err.message : String(err)
      });
      subject.complete();
      await this.repository.fail(runId);
    } finally {
      this.subjects.delete(runId);
    }
  }
}
