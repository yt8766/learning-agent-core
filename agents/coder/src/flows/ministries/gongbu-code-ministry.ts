import { ActionIntent, AgentRole, AgentExecutionState, type PendingExecutionContext } from '@agent/core';

type ActionIntentValue = (typeof ActionIntent)[keyof typeof ActionIntent];

import type { AgentRuntimeContext } from '../../runtime/agent-runtime-context';
import { filterToolsForExecutionMode } from '../../capabilities/execution-mode-guard';
import { StreamingExecutionCoordinator } from '../../runtime/streaming-execution';
import { buildGongbuApprovalPreview, evaluateGongbuApprovalGate } from './gongbu-code/gongbu-code-approval-gate';
import { runGongbuDataReportPipeline } from './gongbu-code/gongbu-code-data-report-pipeline';
import { executeGongbuToolRequest, maybeReadGongbuSearchResult } from './gongbu-code/gongbu-code-execution-runner';
import { executeReadonlyBatch } from './gongbu-code/gongbu-code-readonly-batch';
import { runGongbuScaffoldWorkflow } from './gongbu-code/gongbu-code-scaffold-workflow';
import { selectGongbuExecution } from './gongbu-code/gongbu-code-selection-service';
import {
  buildGongbuToolInput,
  resolveGongbuToolSelection,
  selectGongbuIntent,
  selectPreferredResearchSource,
  selectPreferredToolNameByWorkflow
} from './gongbu-code/gongbu-code-tool-resolution';
import type { ToolDefinition, ToolExecutionResult } from '@agent/runtime';

export class GongbuCodeMinistry {
  protected readonly state: AgentExecutionState;
  protected readonly streamingCoordinator = new StreamingExecutionCoordinator();

  constructor(protected readonly context: AgentRuntimeContext) {
    this.state = {
      agentId: `gongbu_code_${context.taskId}`,
      role: AgentRole.EXECUTOR,
      goal: context.goal,
      plan: [],
      toolCalls: [],
      observations: [],
      shortTermMemory: [],
      longTermMemoryRefs: [],
      status: 'idle'
    };
  }

  async execute(
    subTask: string,
    researchSummary: string
  ): Promise<{
    intent: ActionIntentValue;
    toolName: string;
    requiresApproval: boolean;
    tool?: ToolDefinition;
    executionResult?: ToolExecutionResult;
    summary: string;
    serverId?: string;
    capabilityId?: string;
    approvalReason?: string;
    approvalReasonCode?: string;
    approvalPreview?: Array<{
      label: string;
      value: string;
    }>;
    toolInput?: Record<string, unknown>;
  }> {
    this.state.status = 'running';
    this.state.subTask = subTask;
    this.state.plan = ['选择动作意图', '从工具注册表解析工具', '在受控环境中执行'];
    this.state.observations = [researchSummary];
    this.state.shortTermMemory = [researchSummary];

    if (this.context.workflowPreset?.id === 'data-report') {
      return this.executeDataReportPipeline(researchSummary);
    }
    if (this.context.workflowPreset?.id === 'scaffold') {
      return this.executeScaffoldWorkflow(researchSummary);
    }

    const allowedCapabilities = this.context.workflowPreset?.allowedCapabilities;
    const candidateTools = filterToolsForExecutionMode(
      this.context.toolRegistry.list().filter(tool => !allowedCapabilities || allowedCapabilities.includes(tool.name)),
      this.context.executionMode
    );
    const availableTools = candidateTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      riskLevel: tool.riskLevel,
      requiresApproval: tool.requiresApproval
    }));
    const llmSelection = await selectGongbuExecution({
      context: this.context,
      researchSummary,
      availableTools
    });

    const intent = llmSelection?.intent ?? this.selectIntent(this.context.goal);
    const tool = resolveGongbuToolSelection({
      context: this.context,
      llmSelection,
      intent,
      candidateTools
    });

    if (!tool) {
      this.state.status = 'failed';
      const summary = '工部无法在当前 Skill 的能力白名单内解析出可用工具。';
      this.state.finalOutput = summary;
      return {
        intent,
        toolName: 'unresolved_tool',
        requiresApproval: false,
        summary
      };
    }

    const actionPrompt =
      llmSelection?.actionPrompt ??
      `目标：${this.context.goal}；任务上下文：${this.context.taskContext ?? '无'}；研究摘要：${researchSummary}`;
    this.state.toolCalls.push(`intent:${intent}`, `tool:${tool.name}`);
    this.state.observations.push(
      llmSelection?.rationale ??
        `已选择 ${intent}，对应工具 ${tool.name}。${this.context.workflowPreset ? `当前 Skill：${this.context.workflowPreset.displayName}` : ''}`
    );

    const toolInput = this.buildToolInput(tool.name, actionPrompt, researchSummary);
    const approvalEvaluation = await evaluateGongbuApprovalGate(this.context, intent, tool, toolInput);
    if (approvalEvaluation.requiresApproval) {
      this.state.status = 'waiting_approval';
      const summary = `执行已暂停：${intent} 使用 ${tool.name} 需要人工审批。${approvalEvaluation.reason}`;
      this.state.finalOutput = summary;
      return {
        intent,
        toolName: tool.name,
        tool,
        requiresApproval: true,
        summary,
        toolInput,
        approvalPreview: this.buildApprovalPreview(tool.name, toolInput),
        approvalReason: approvalEvaluation.reason,
        approvalReasonCode: approvalEvaluation.reasonCode
      };
    }

    const executionResult = tool.isReadOnly
      ? await executeReadonlyBatch({
          coordinator: this.streamingCoordinator,
          context: this.context,
          selectedTool: tool,
          candidateTools,
          researchSummary,
          actionPrompt,
          source: this.constructor.name,
          buildToolInput: (toolName, currentActionPrompt, currentResearchSummary) =>
            this.buildToolInput(toolName, currentActionPrompt, currentResearchSummary),
          runTool: (resolvedTool, resolvedIntent, input) => this.executeSingleTool(resolvedTool, resolvedIntent, input),
          onEvent: event => {
            this.state.toolCalls.push(`${event.type}:${event.toolName}`);
            if (event.type === 'tool_stream_dispatched') {
              this.state.observations.push(`工部/兵部已流式派发 ${event.toolName}（${event.scheduling}）`);
            }
          }
        })
      : await this.executeSingleTool(tool, intent, toolInput);

    if (
      executionResult.errorMessage === 'watchdog_timeout' ||
      executionResult.errorMessage === 'watchdog_interaction_required'
    ) {
      this.state.status = 'waiting_approval';
      const summary = `执行已暂停：${tool.name} 命中兵部看门狗，需要人工干预。${executionResult.outputSummary}`;
      this.state.finalOutput = summary;
      return {
        intent,
        toolName: tool.name,
        tool,
        requiresApproval: true,
        summary,
        toolInput,
        approvalPreview: this.buildApprovalPreview(tool.name, toolInput),
        approvalReason: executionResult.outputSummary,
        approvalReasonCode: executionResult.errorMessage
      };
    }

    const enrichedExecution = await this.maybeReadSearchResult(
      tool.name,
      executionResult,
      researchSummary,
      actionPrompt
    );

    this.state.observations.push(enrichedExecution.outputSummary);
    this.state.shortTermMemory = [researchSummary, enrichedExecution.outputSummary];
    this.state.finalOutput = enrichedExecution.outputSummary;
    this.state.status = 'completed';
    return {
      intent,
      toolName: tool.name,
      tool,
      requiresApproval: false,
      executionResult: enrichedExecution,
      summary: enrichedExecution.outputSummary
    };
  }

  protected async executeSingleTool(
    tool: ToolDefinition,
    intent: ActionIntentValue,
    toolInput: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    return executeGongbuToolRequest(this.context, tool, intent, toolInput);
  }

  protected executeDataReportPipeline(researchSummary: string) {
    return runGongbuDataReportPipeline(this.context, this.state, researchSummary, {
      executeSingleTool: (tool, intent, toolInput) => this.executeSingleTool(tool, intent, toolInput),
      buildToolInput: (toolName, actionPrompt, summary, overrides) =>
        this.buildToolInput(toolName, actionPrompt, summary, overrides)
    });
  }

  protected executeScaffoldWorkflow(researchSummary: string) {
    return runGongbuScaffoldWorkflow(this.context, this.state, researchSummary, {
      executeSingleTool: (tool, intent, toolInput) => this.executeSingleTool(tool, intent, toolInput),
      buildToolInput: (toolName, actionPrompt, summary, overrides) =>
        this.buildToolInput(toolName, actionPrompt, summary, overrides),
      buildApprovalPreview: (toolName, input) => this.buildApprovalPreview(toolName, input)
    });
  }

  buildApprovedState(executionResult: ToolExecutionResult, pending: PendingExecutionContext): AgentExecutionState {
    this.state.status = 'completed';
    this.state.subTask = 'Execute the approved action';
    this.state.plan = ['Receive human approval', 'Execute approved high-risk action'];
    this.state.toolCalls = [`intent:${pending.intent}`, `tool:${pending.toolName}`];
    this.state.observations = [executionResult.outputSummary];
    this.state.shortTermMemory = [pending.researchSummary, executionResult.outputSummary];
    this.state.finalOutput = executionResult.outputSummary;
    return this.state;
  }

  getState(): AgentExecutionState {
    return this.state;
  }

  protected selectIntent(goal: string): ActionIntentValue {
    return selectGongbuIntent(goal);
  }

  protected buildToolInput(
    toolName: string,
    actionPrompt: string,
    researchSummary: string,
    overrides?: Record<string, unknown>
  ): Record<string, unknown> {
    return buildGongbuToolInput(this.context, toolName, actionPrompt, researchSummary, overrides);
  }

  protected buildApprovalPreview(toolName: string, input: Record<string, unknown>) {
    return buildGongbuApprovalPreview(toolName, input);
  }

  protected selectPreferredToolNameByWorkflow(): string | undefined {
    return selectPreferredToolNameByWorkflow(this.context);
  }

  protected selectPreferredResearchSource() {
    return selectPreferredResearchSource(this.context);
  }

  protected async maybeReadSearchResult(
    toolName: string,
    executionResult: ToolExecutionResult,
    researchSummary: string,
    actionPrompt: string
  ): Promise<ToolExecutionResult> {
    return maybeReadGongbuSearchResult({
      context: this.context,
      toolName,
      executionResult,
      researchSummary,
      actionPrompt
    });
  }
}
