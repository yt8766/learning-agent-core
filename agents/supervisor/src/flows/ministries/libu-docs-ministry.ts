import {
  ActionIntent,
  AgentExecutionState,
  AgentRole,
  EvaluationResult,
  MemoryRecord,
  ReviewRecord,
  SkillCard,
  TaskRecord,
  ToolExecutionResult
} from '@agent/shared';

import { AgentRuntimeContext } from '../../runtime/agent-runtime-context';

export class LibuDocsMinistry {
  private readonly state: AgentExecutionState;

  constructor(private readonly context: AgentRuntimeContext) {
    this.state = {
      agentId: `libu_docs_${context.taskId}`,
      role: AgentRole.REVIEWER,
      goal: context.goal,
      plan: [],
      toolCalls: [],
      observations: [],
      shortTermMemory: [],
      longTermMemoryRefs: [],
      status: 'idle'
    };
  }

  async research(task: TaskRecord): Promise<{ summary: string; memories: MemoryRecord[]; skills: SkillCard[] }> {
    this.state.status = 'running';
    this.state.subTask = '整理交付规范';
    this.state.plan = ['读取 workflow 输出契约', '整理 required sections', '输出礼部研究摘要'];
    const policySummary = task.resolvedWorkflow?.webLearningPolicy?.enabled
      ? `研究策略：优先参考 ${task.resolvedWorkflow.webLearningPolicy.preferredSourceTypes.join('、')}。`
      : '研究策略：以现有上下文为主。';
    const summary = `礼部已整理目标所需的交付规范：${task.resolvedWorkflow?.outputContract.requiredSections.join('、') ?? 'summary'}。${policySummary}`;
    this.state.observations = [summary];
    this.state.shortTermMemory = [summary];
    this.state.finalOutput = summary;
    this.state.status = 'completed';
    return {
      summary,
      memories: [],
      skills: []
    };
  }

  async execute(
    task: TaskRecord,
    executionSummary: string
  ): Promise<{
    intent: ActionIntent;
    toolName: string;
    requiresApproval: boolean;
    tool?: never;
    executionResult?: ToolExecutionResult;
    summary: string;
    serverId?: string;
    capabilityId?: string;
    approvalPreview?: Array<{
      label: string;
      value: string;
    }>;
  }> {
    this.state.status = 'running';
    this.state.subTask = '整理交付说明';
    const summary = this.buildDelivery(task, executionSummary);
    this.state.observations = [summary];
    this.state.shortTermMemory = [summary];
    this.state.finalOutput = summary;
    this.state.status = 'completed';
    return {
      intent: ActionIntent.READ_FILE,
      toolName: 'documentation',
      requiresApproval: false,
      executionResult: {
        ok: true,
        outputSummary: summary,
        rawOutput: {
          outputType: task.resolvedWorkflow?.outputContract.type
        },
        durationMs: 1,
        exitCode: 0
      },
      summary
    };
  }

  review(task: TaskRecord, executionSummary: string): { review: ReviewRecord; evaluation: EvaluationResult } {
    this.state.status = 'running';
    this.state.subTask = '礼部复核交付';
    const note = `礼部复核通过：${executionSummary}`;
    this.state.observations = [note];
    this.state.shortTermMemory = [note];
    this.state.finalOutput = note;
    this.state.status = 'completed';
    return {
      review: {
        taskId: task.id,
        decision: 'approved',
        notes: ['礼部已确认当前产出可整理为正式交付文档。'],
        createdAt: new Date().toISOString()
      },
      evaluation: {
        success: true,
        quality: 'high',
        shouldRetry: false,
        shouldWriteMemory: false,
        shouldCreateRule: false,
        shouldExtractSkill: false,
        notes: [note]
      }
    };
  }

  buildDelivery(task: TaskRecord, executionSummary: string): string {
    const sections = task.resolvedWorkflow?.outputContract.requiredSections.join('、') ?? 'summary';
    return `礼部已整理 ${task.resolvedWorkflow?.displayName ?? '当前流程'} 的交付说明，重点覆盖：${sections}。当前执行摘要：${executionSummary}`;
  }

  getState(): AgentExecutionState {
    return this.state;
  }
}
