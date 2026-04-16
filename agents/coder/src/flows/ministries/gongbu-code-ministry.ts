import { ActionIntent, AgentExecutionState, AgentRole, ToolDefinition, ToolExecutionResult } from '@agent/shared';
import type { PendingExecutionContext } from '@agent/core';

import type { AgentRuntimeContext } from '../../runtime/agent-runtime-context';
import { filterToolsForExecutionMode } from '../../capabilities/execution-mode-guard';
import { StreamingExecutionCoordinator } from '../../runtime/streaming-execution';
import { buildGongbuApprovalPreview, evaluateGongbuApprovalGate } from './gongbu-code/gongbu-code-approval-gate';
import { executeGongbuToolRequest, maybeReadGongbuSearchResult } from './gongbu-code/gongbu-code-execution-runner';
import { executeReadonlyBatch } from './gongbu-code/gongbu-code-readonly-batch';
import { selectGongbuExecution } from './gongbu-code/gongbu-code-selection-service';
import {
  buildGongbuToolInput,
  resolveGongbuToolSelection,
  selectGongbuIntent,
  selectPreferredResearchSource,
  selectPreferredToolNameByWorkflow
} from './gongbu-code/gongbu-code-tool-resolution';
import {
  inspectScaffoldWriteCommand,
  resolveScaffoldIntent,
  resolveScaffoldToolName
} from './gongbu-code/gongbu-code-scaffold';

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
    intent: ActionIntent;
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
    intent: ActionIntent,
    toolInput: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    return executeGongbuToolRequest(this.context, tool, intent, toolInput);
  }

  protected async executeDataReportPipeline(researchSummary: string): Promise<{
    intent: ActionIntent;
    toolName: string;
    requiresApproval: boolean;
    tool?: ToolDefinition;
    executionResult?: ToolExecutionResult;
    summary: string;
    approvalReason?: string;
    approvalReasonCode?: string;
    approvalPreview?: Array<{
      label: string;
      value: string;
    }>;
    toolInput?: Record<string, unknown>;
  }> {
    const intent = ActionIntent.READ_FILE;
    const stageToolNames = [
      'plan_data_report_structure',
      'generate_data_report_module',
      'generate_data_report_scaffold',
      'generate_data_report_routes',
      'assemble_data_report_bundle'
    ] as const;
    const blueprintTool = this.context.toolRegistry.get('plan_data_report_structure');
    const moduleTool = this.context.toolRegistry.get('generate_data_report_module');
    const sharedTool = this.context.toolRegistry.get('generate_data_report_scaffold');
    const routeTool = this.context.toolRegistry.get('generate_data_report_routes');
    const assembleTool = this.context.toolRegistry.get('assemble_data_report_bundle');

    if (!blueprintTool || !moduleTool || !sharedTool || !routeTool || !assembleTool) {
      const summary = '工部无法完成数据报表分阶段生成，缺少必要的只读工具。';
      this.state.status = 'failed';
      this.state.finalOutput = summary;
      return {
        intent,
        toolName: 'unresolved_data_report_pipeline',
        requiresApproval: false,
        summary
      };
    }

    const actionPrompt = `目标：${this.context.goal}；任务上下文：${this.context.taskContext ?? '无'}；研究摘要：${researchSummary}`;
    this.state.plan = ['规划报表蓝图', '按模块生成报表文件', '生成共享骨架', '生成预览路由', '组装 Sandpack 预览'];

    const blueprintResult = await this.executeSingleTool(
      blueprintTool,
      intent,
      this.buildToolInput(blueprintTool.name, actionPrompt, researchSummary)
    );
    const blueprint = blueprintResult.rawOutput as
      | {
          templateId?: string;
          moduleIds?: string[];
          modules?: Array<{ id: string }>;
        }
      | undefined;
    const moduleIds =
      blueprint?.moduleIds ?? blueprint?.modules?.map(module => module.id).filter(Boolean) ?? ([] as string[]);

    const moduleResults: ToolExecutionResult[] = [];
    for (const moduleId of moduleIds) {
      moduleResults.push(
        await this.executeSingleTool(
          moduleTool,
          intent,
          this.buildToolInput(moduleTool.name, actionPrompt, researchSummary, { moduleId })
        )
      );
    }

    const sharedResult = await this.executeSingleTool(
      sharedTool,
      intent,
      this.buildToolInput(sharedTool.name, actionPrompt, researchSummary)
    );
    const sharedFiles = Array.isArray((sharedResult.rawOutput as { files?: unknown[] } | undefined)?.files)
      ? (((sharedResult.rawOutput as { files?: unknown[] }).files ?? []) as unknown[])
      : [];
    const routeResult = await this.executeSingleTool(
      routeTool,
      intent,
      this.buildToolInput(routeTool.name, actionPrompt, researchSummary, {
        blueprint
      })
    );
    const routeFiles = Array.isArray((routeResult.rawOutput as { files?: unknown[] } | undefined)?.files)
      ? (((routeResult.rawOutput as { files?: unknown[] }).files ?? []) as unknown[])
      : [];
    const assemblyResult = await this.executeSingleTool(
      assembleTool,
      intent,
      this.buildToolInput(assembleTool.name, actionPrompt, researchSummary, {
        blueprint,
        moduleResults: moduleResults.map(item => item.rawOutput),
        sharedFiles,
        routeFiles
      })
    );

    const stageSummary = [
      blueprintResult.outputSummary,
      ...moduleResults.map(item => item.outputSummary),
      sharedResult.outputSummary,
      routeResult.outputSummary,
      assemblyResult.outputSummary
    ].join('；');
    this.state.toolCalls.push(...stageToolNames.map(toolName => `tool:${toolName}`));
    this.state.observations.push(
      `数据报表流程已完成 blueprint/module/shared/routes/assembly 五段执行。模块数：${moduleIds.length || moduleResults.length}。`
    );
    if (blueprint?.templateId) {
      this.state.observations.push(`模板来源：${blueprint.templateId}`);
    }
    this.state.shortTermMemory = [researchSummary, stageSummary];
    this.state.finalOutput = stageSummary;
    this.state.status = 'completed';

    return {
      intent,
      toolName: assembleTool.name,
      tool: assembleTool,
      requiresApproval: false,
      executionResult: assemblyResult,
      summary: assemblyResult.outputSummary
    };
  }

  protected async executeScaffoldWorkflow(researchSummary: string): Promise<{
    intent: ActionIntent;
    toolName: string;
    requiresApproval: boolean;
    tool?: ToolDefinition;
    executionResult?: ToolExecutionResult;
    summary: string;
    approvalReason?: string;
    approvalReasonCode?: string;
    approvalPreview?: Array<{
      label: string;
      value: string;
    }>;
    toolInput?: Record<string, unknown>;
  }> {
    let toolName: string;
    let intent: ActionIntent;
    let toolInput: Record<string, unknown>;

    try {
      toolName = resolveScaffoldToolName(this.context.goal);
      intent = resolveScaffoldIntent(this.context.goal);
      toolInput = this.buildToolInput(toolName, `脚手架流程：${this.context.goal}`, researchSummary);
    } catch (error) {
      const summary = error instanceof Error ? error.message : '无法解析 /scaffold 命令。';
      this.state.status = 'failed';
      this.state.finalOutput = summary;
      return {
        intent: ActionIntent.READ_FILE,
        toolName: 'invalid_scaffold_command',
        requiresApproval: false,
        summary
      };
    }

    const tool = this.context.toolRegistry.get(toolName);
    if (!tool) {
      const summary = `工部无法找到 /scaffold 所需工具 ${toolName}。`;
      this.state.status = 'failed';
      this.state.finalOutput = summary;
      return {
        intent,
        toolName,
        requiresApproval: false,
        summary,
        toolInput
      };
    }

    this.state.plan = ['解析 /scaffold 命令', '生成脚手架预览或预检', '在需要时执行审批与写入'];
    this.state.toolCalls.push(`intent:${intent}`, `tool:${tool.name}`);
    this.state.observations.push(`已进入 ${this.context.workflowPreset?.displayName ?? '脚手架'} 显式流程。`);

    if (tool.name === 'write_scaffold') {
      const { bundle, inspection } = await inspectScaffoldWriteCommand(this.context.goal);
      if (!inspection.canWriteSafely && toolInput.force !== true) {
        const summary = `Scaffold target is not empty: ${inspection.targetRoot}`;
        const executionResult: ToolExecutionResult = {
          ok: true,
          outputSummary: summary,
          rawOutput: {
            blocked: true,
            inspection,
            bundle
          },
          exitCode: 0,
          durationMs: 0
        };
        this.state.observations.push(summary);
        this.state.shortTermMemory = [researchSummary, summary];
        this.state.finalOutput = summary;
        this.state.status = 'completed';
        return {
          intent,
          toolName: tool.name,
          tool,
          requiresApproval: false,
          executionResult,
          summary,
          toolInput
        };
      }
    }

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

    const executionResult = await this.executeSingleTool(tool, intent, toolInput);
    this.state.observations.push(executionResult.outputSummary);
    this.state.shortTermMemory = [researchSummary, executionResult.outputSummary];
    this.state.finalOutput = executionResult.outputSummary;
    this.state.status = 'completed';

    return {
      intent,
      toolName: tool.name,
      tool,
      requiresApproval: false,
      executionResult,
      summary: executionResult.outputSummary,
      toolInput
    };
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

  protected selectIntent(goal: string): ActionIntent {
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
