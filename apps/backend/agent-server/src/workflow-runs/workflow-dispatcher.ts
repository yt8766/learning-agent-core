// apps/backend/agent-server/src/workflow-runs/workflow-dispatcher.ts
import { Injectable, NotFoundException } from '@nestjs/common';

import type { CompanyLiveGenerateResult, CompanyLiveNodeTrace } from '@agent/core';
import { createCompanyLiveStubRegistry, executeCompanyLiveGraph } from '@agent/agents-company-live';

import { parseCompanyLiveGenerateDto } from '../company-live/company-live.dto';

export type WorkflowResult = CompanyLiveGenerateResult;
export type NodeCompleteCallback = (trace: CompanyLiveNodeTrace) => void;

@Injectable()
export class WorkflowDispatcher {
  async dispatch(
    workflowId: string,
    input: Record<string, unknown>,
    onNodeComplete: NodeCompleteCallback
  ): Promise<WorkflowResult> {
    if (workflowId === 'company-live') {
      const brief = parseCompanyLiveGenerateDto(input);
      const registry = createCompanyLiveStubRegistry();
      return executeCompanyLiveGraph(brief, registry, { onNodeComplete });
    }
    throw new NotFoundException(`Unknown workflowId: ${workflowId}`);
  }

  listWorkflowIds(): string[] {
    return ['company-live'];
  }
}
