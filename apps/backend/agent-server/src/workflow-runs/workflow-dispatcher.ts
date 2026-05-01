// apps/backend/agent-server/src/workflow-runs/workflow-dispatcher.ts
import { Injectable } from '@nestjs/common';

import type { CompanyLiveGenerateResult } from '@agent/core';

import { RuntimeWorkflowExecutionFacade } from '../runtime/core/runtime-workflow-execution-facade';
import type { ReportBundleGenerateResult } from '../runtime/core/runtime-data-report-facade';
import type { WorkflowNodeTrace } from './workflow-runs.types';

export type WorkflowResult = CompanyLiveGenerateResult | (ReportBundleGenerateResult & { trace: WorkflowNodeTrace[] });
export type NodeCompleteCallback = (trace: WorkflowNodeTrace) => void;

@Injectable()
export class WorkflowDispatcher {
  constructor(private readonly workflowExecutionFacade: RuntimeWorkflowExecutionFacade) {}

  async dispatch(
    workflowId: string,
    input: Record<string, unknown>,
    onNodeComplete: NodeCompleteCallback
  ): Promise<WorkflowResult> {
    return this.workflowExecutionFacade.executeWorkflow({
      workflowId,
      input,
      onStage: event => {
        if (event.status === 'pending') {
          return;
        }
        onNodeComplete({
          nodeId: event.nodeId,
          status: event.status,
          durationMs: event.durationMs ?? 0,
          inputSnapshot: event.inputSnapshot,
          outputSnapshot: event.outputSnapshot
        });
      }
    }) as Promise<WorkflowResult>;
  }

  listWorkflowIds(): string[] {
    return this.workflowExecutionFacade.listWorkflowIds();
  }
}
