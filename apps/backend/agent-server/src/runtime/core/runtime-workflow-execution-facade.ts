import { Injectable, NotFoundException } from '@nestjs/common';

import {
  createPlatformWorkflowRegistry,
  type WorkflowExecutionInput,
  type WorkflowRegistry,
  type WorkflowStageEvent
} from '@agent/platform-runtime';

import { parseCompanyLiveGenerateDto } from '../../company-live/company-live.dto';
import type { WorkflowNodeTrace } from '../../workflow-runs/workflow-runs.types';
import { RuntimeCompanyLiveFacade } from './runtime-company-live-facade';
import {
  executeReportBundleGenerateFlow,
  type DataReportJsonNodeStageEvent,
  type DataReportJsonStructuredInput,
  type ReportBundleGenerateResult
} from './runtime-data-report-facade';

interface DataReportJsonWorkflowInput {
  message: string;
  projectId?: string;
  currentProjectPath?: string;
  structuredSeed?: DataReportJsonStructuredInput;
}

function parseDataReportJsonWorkflowInput(input: Record<string, unknown>): DataReportJsonWorkflowInput {
  const message = typeof input.message === 'string' && input.message.trim() ? input.message.trim() : '';
  if (!message) {
    throw new Error('data-report-json workflow requires a non-empty message.');
  }

  return {
    message,
    projectId: typeof input.projectId === 'string' ? input.projectId : undefined,
    currentProjectPath: typeof input.currentProjectPath === 'string' ? input.currentProjectPath : undefined,
    structuredSeed: input.structuredSeed as DataReportJsonStructuredInput | undefined
  };
}

function mapDataReportStageStatus(status: DataReportJsonNodeStageEvent['status']): WorkflowNodeTrace['status'] {
  if (status === 'success') {
    return 'succeeded';
  }
  if (status === 'error') {
    return 'failed';
  }
  return 'skipped';
}

function toWorkflowStageEvent(workflowId: string, trace: WorkflowNodeTrace): WorkflowStageEvent {
  return {
    workflowId,
    nodeId: trace.nodeId,
    status: trace.status,
    durationMs: trace.durationMs,
    inputSnapshot: trace.inputSnapshot,
    outputSnapshot: trace.outputSnapshot
  };
}

@Injectable()
export class RuntimeWorkflowExecutionFacade {
  private readonly registry: WorkflowRegistry;

  constructor(private readonly companyLiveFacade: RuntimeCompanyLiveFacade) {
    this.registry = createPlatformWorkflowRegistry([
      {
        descriptor: {
          id: 'company-live',
          displayName: 'Company Live',
          agentIds: ['official.company-live']
        },
        execute: input => this.executeCompanyLive(input)
      },
      {
        descriptor: {
          id: 'data-report-json',
          displayName: 'Data Report JSON',
          agentIds: ['official.data-report']
        },
        execute: input => this.executeDataReportJson(input)
      }
    ]);
  }

  listWorkflowIds(): string[] {
    return this.registry.listWorkflows().map(workflow => workflow.id);
  }

  async executeWorkflow(input: WorkflowExecutionInput): Promise<unknown> {
    try {
      const result = await this.registry.executeWorkflow(input);
      return result.output;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Unknown workflowId:')) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  private async executeCompanyLive(input: WorkflowExecutionInput) {
    const result = await this.companyLiveFacade.generate(parseCompanyLiveGenerateDto(input.input), {
      onNodeComplete: trace => input.onStage?.(toWorkflowStageEvent(input.workflowId, trace))
    });

    return {
      workflowId: input.workflowId,
      status: 'succeeded' as const,
      output: result,
      trace: result.trace.map(trace => toWorkflowStageEvent(input.workflowId, trace))
    };
  }

  private async executeDataReportJson(input: WorkflowExecutionInput) {
    const parsed = parseDataReportJsonWorkflowInput(input.input);
    const stageStartedAt = new Map<string, number>();
    const trace: WorkflowNodeTrace[] = [];
    const emittedNodes = new Set<string>();

    const emitTrace = (nodeTrace: WorkflowNodeTrace) => {
      emittedNodes.add(nodeTrace.nodeId);
      trace.push(nodeTrace);
      input.onStage?.(toWorkflowStageEvent(input.workflowId, nodeTrace));
    };

    const result = await executeReportBundleGenerateFlow(
      {
        messages: [
          {
            role: 'user',
            content: parsed.message
          }
        ],
        structuredSeed: parsed.structuredSeed,
        context: {
          projectId: parsed.projectId,
          currentProjectPath: parsed.currentProjectPath
        },
        disableCache: true,
        onStage: event => {
          if (event.status === 'pending') {
            stageStartedAt.set(event.node, Date.now());
            return;
          }

          const startedAt = stageStartedAt.get(event.node);
          emitTrace({
            nodeId: event.node,
            status: mapDataReportStageStatus(event.status),
            durationMs:
              event.details?.elapsedMs && typeof event.details.elapsedMs === 'number'
                ? event.details.elapsedMs
                : startedAt
                  ? Date.now() - startedAt
                  : 0,
            inputSnapshot: {
              workflowId: input.workflowId,
              modelId: event.modelId,
              cacheHit: event.cacheHit
            },
            outputSnapshot: {
              status: event.status,
              details: event.details ?? {}
            }
          });
        }
      },
      {}
    );

    for (const [nodeId, durationMs] of Object.entries(result.runtime.jsonRuntime?.nodeDurations ?? {})) {
      if (emittedNodes.has(nodeId)) {
        continue;
      }
      emitTrace({
        nodeId,
        status: 'succeeded',
        durationMs,
        inputSnapshot: {
          workflowId: input.workflowId
        },
        outputSnapshot: {
          status: result.status
        }
      });
    }

    const output: ReportBundleGenerateResult & { trace: WorkflowNodeTrace[] } = {
      ...result,
      trace
    };

    return {
      workflowId: input.workflowId,
      status: result.status === 'failed' ? ('failed' as const) : ('succeeded' as const),
      output,
      trace: trace.map(nodeTrace => toWorkflowStageEvent(input.workflowId, nodeTrace))
    };
  }
}
