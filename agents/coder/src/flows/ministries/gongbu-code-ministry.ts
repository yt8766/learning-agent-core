import { ActionIntent, AgentExecutionState, AgentRole, ToolDefinition, ToolExecutionResult } from '@agent/shared';

import { AgentRuntimeContext } from '../../runtime/agent-runtime-context';
import { filterToolsForExecutionMode, isToolAllowedInExecutionMode } from '../../capabilities/execution-mode-guard';
import { type ExecutionStepRecord, StreamingExecutionCoordinator } from '../../runtime/streaming-execution';
import { withReactiveContextRetry } from '../../utils/reactive-context-retry';
import { generateObjectWithRetry } from '../../utils/llm-retry';
import type { PendingExecutionContext } from '@agent/core';
import { GONGBU_EXECUTION_SYSTEM_PROMPT } from './gongbu-code/prompts/execution-prompts';
import { ExecutionActionSchema } from './gongbu-code/schemas/execution-action-schema';

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
  }> {
    this.state.status = 'running';
    this.state.subTask = subTask;
    this.state.plan = ['选择动作意图', '从工具注册表解析工具', '在受控环境中执行'];
    this.state.observations = [researchSummary];
    this.state.shortTermMemory = [researchSummary];

    if (this.context.workflowPreset?.id === 'data-report') {
      return this.executeDataReportPipeline(researchSummary);
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

    let llmSelection: {
      intent: ActionIntent;
      toolName: string;
      rationale: string;
      actionPrompt: string;
    } | null = null;
    if (this.context.llm.isConfigured()) {
      try {
        llmSelection = await withReactiveContextRetry({
          context: this.context,
          trigger: 'gongbu-selection',
          messages: [
            {
              role: 'system',
              content: GONGBU_EXECUTION_SYSTEM_PROMPT
            },
            {
              role: 'user',
              content: JSON.stringify({
                goal: this.context.goal,
                taskContext: this.context.taskContext,
                researchSummary,
                availableTools
              })
            }
          ],
          invoke: async messages =>
            generateObjectWithRetry({
              llm: this.context.llm,
              contractName: 'gongbu-execution-selection',
              contractVersion: 'gongbu-execution-selection.v1',
              messages,
              schema: ExecutionActionSchema,
              options: {
                role: 'executor',
                modelId: this.context.currentWorker?.defaultModel,
                taskId: this.context.taskId,
                thinking: this.context.thinking.executor,
                temperature: 0.1,
                budgetState: this.context.budgetState,
                onUsage: usage => {
                  this.context.onUsage?.({
                    usage,
                    role: 'executor'
                  });
                }
              }
            })
        });
      } catch {
        llmSelection = null;
      }
    }

    const fallbackIntent = this.selectIntent(this.context.goal);
    const intent = llmSelection?.intent ?? fallbackIntent;
    const presetPreferredToolName = this.selectPreferredToolNameByWorkflow();
    const llmSelectedTool = llmSelection?.toolName ? this.context.toolRegistry.get(llmSelection.toolName) : undefined;
    const presetPreferredTool = presetPreferredToolName
      ? this.context.toolRegistry.get(presetPreferredToolName)
      : undefined;
    const preferredTool =
      llmSelection?.toolName &&
      (!allowedCapabilities || allowedCapabilities.includes(llmSelection.toolName)) &&
      llmSelectedTool &&
      isToolAllowedInExecutionMode(llmSelectedTool, this.context.executionMode)
        ? llmSelectedTool
        : undefined;
    const presetTool =
      presetPreferredToolName &&
      (!allowedCapabilities || allowedCapabilities.includes(presetPreferredToolName)) &&
      presetPreferredTool &&
      isToolAllowedInExecutionMode(presetPreferredTool, this.context.executionMode)
        ? presetPreferredTool
        : undefined;
    const mappedTool = this.context.toolRegistry.getForIntent(intent);
    const fallbackTool = candidateTools.find(tool => tool.name === 'local-analysis') ?? candidateTools[0];
    const tool =
      preferredTool ??
      presetTool ??
      (mappedTool &&
      (!allowedCapabilities || allowedCapabilities.includes(mappedTool.name)) &&
      isToolAllowedInExecutionMode(mappedTool, this.context.executionMode)
        ? mappedTool
        : undefined) ??
      fallbackTool;

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
    const approvalEvaluation = await this.context.approvalService.evaluateWithClassifier(intent, tool, {
      ...toolInput,
      executionMode: this.context.executionMode,
      currentMinistry: this.context.currentWorker?.ministry,
      currentWorker: this.context.currentWorker?.id
    });
    const requiresApproval = approvalEvaluation.requiresApproval;
    if (requiresApproval) {
      this.state.status = 'waiting_approval';
      const summary = `执行已暂停：${intent} 使用 ${tool.name} 需要人工审批。${approvalEvaluation.reason}`;
      this.state.finalOutput = summary;
      return {
        intent,
        toolName: tool.name,
        tool,
        requiresApproval: true,
        summary,
        approvalPreview: this.buildApprovalPreview(tool.name, toolInput),
        approvalReason: approvalEvaluation.reason,
        approvalReasonCode: approvalEvaluation.reasonCode
      };
    }

    const executionResult = tool.isReadOnly
      ? await this.executeReadonlyBatch(tool, candidateTools, intent, researchSummary, actionPrompt)
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
    const request = {
      taskId: this.context.taskId,
      toolName: tool.name,
      intent,
      input: toolInput,
      requestedBy: 'agent' as const
    };

    return this.context.mcpClientManager
      ? await this.context.mcpClientManager.invokeCapability(tool.name, request)
      : await this.context.sandbox.execute(request);
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
  }> {
    const intent = ActionIntent.READ_FILE;
    const stageToolNames = [
      'plan_data_report_structure',
      'generate_data_report_module',
      'generate_data_report_scaffold',
      'generate_data_report_routes',
      'assemble_data_report_bundle'
    ] as const;
    const blueprintToolName = 'plan_data_report_structure';
    const moduleToolName = 'generate_data_report_module';
    const sharedToolName = 'generate_data_report_scaffold';
    const routeToolName = 'generate_data_report_routes';
    const assembleToolName = 'assemble_data_report_bundle';
    const blueprintTool = this.context.toolRegistry.get(blueprintToolName);
    const moduleTool = this.context.toolRegistry.get(moduleToolName);
    const sharedTool = this.context.toolRegistry.get(sharedToolName);
    const routeTool = this.context.toolRegistry.get(routeToolName);
    const assembleTool = this.context.toolRegistry.get(assembleToolName);

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
      const moduleResult = await this.executeSingleTool(
        moduleTool,
        intent,
        this.buildToolInput(moduleTool.name, actionPrompt, researchSummary, { moduleId })
      );
      moduleResults.push(moduleResult);
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

  protected async executeReadonlyBatch(
    selectedTool: ToolDefinition,
    candidateTools: ToolDefinition[],
    intent: ActionIntent,
    researchSummary: string,
    actionPrompt: string
  ): Promise<ToolExecutionResult> {
    const readonlyTools = [selectedTool]
      .concat(
        candidateTools.filter(
          tool =>
            tool.name !== selectedTool.name &&
            tool.isReadOnly &&
            tool.supportsStreamingDispatch &&
            [
              'read_local_file',
              'list_directory',
              'glob_workspace',
              'search_in_files',
              'read_json',
              'browse_page'
            ].includes(tool.name)
        )
      )
      .slice(0, 3);

    if (readonlyTools.length === 1) {
      return this.executeSingleTool(
        selectedTool,
        intent,
        this.buildToolInput(selectedTool.name, actionPrompt, researchSummary)
      );
    }

    const { results, events } = await this.streamingCoordinator.run(
      this.buildReadonlyExecutionSteps(readonlyTools, researchSummary, actionPrompt),
      {
        shouldContinue: () => !this.context.isTaskCancelled?.(),
        allowStep: async step => !step.tool.isDestructive
      }
    );
    for (const event of events) {
      this.state.toolCalls.push(`${event.type}:${event.toolName}`);
      if (event.type === 'tool_stream_dispatched') {
        this.state.observations.push(`工部/兵部已流式派发 ${event.toolName}（${event.scheduling}）`);
      }
    }

    return {
      ok: results.every(item => item.ok),
      outputSummary: results.map(item => item.outputSummary).join('；'),
      rawOutput: {
        batch: true,
        toolNames: readonlyTools.map(item => item.name),
        outputs: results.map(item => item.rawOutput)
      },
      exitCode: results.some(item => (item.exitCode ?? 0) !== 0) ? 1 : 0,
      durationMs: results.reduce((sum, item) => sum + item.durationMs, 0),
      errorMessage: results.find(item => item.errorMessage)?.errorMessage
    };
  }

  protected buildReadonlyExecutionSteps(
    readonlyTools: ToolDefinition[],
    researchSummary: string,
    actionPrompt: string
  ): ExecutionStepRecord<Record<string, unknown>, ToolExecutionResult>[] {
    return readonlyTools.map(tool => {
      const inputPreview = this.buildToolInput(tool.name, actionPrompt, researchSummary);
      return {
        id: `${this.context.taskId}:${tool.name}`,
        toolName: tool.name,
        ministry: this.context.currentWorker?.ministry,
        source: this.constructor.name,
        inputPreview,
        streamingEligible: tool.isReadOnly && tool.supportsStreamingDispatch,
        expectedSideEffect: tool.isReadOnly ? 'none' : 'workspace-write',
        tool,
        run: async () => this.executeSingleTool(tool, ActionIntent.READ_FILE, inputPreview)
      };
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

  protected selectIntent(goal: string): ActionIntent {
    const normalizedGoal = goal.toLowerCase();
    if (
      normalizedGoal.includes('delete') ||
      normalizedGoal.includes('remove') ||
      normalizedGoal.includes('cleanup') ||
      normalizedGoal.includes('清理') ||
      normalizedGoal.includes('删除')
    ) {
      return ActionIntent.DELETE_FILE;
    }
    if (
      normalizedGoal.includes('schedule') ||
      normalizedGoal.includes('cron') ||
      normalizedGoal.includes('timer') ||
      normalizedGoal.includes('定时') ||
      normalizedGoal.includes('提醒')
    ) {
      return ActionIntent.SCHEDULE_TASK;
    }
    if (normalizedGoal.includes('write') || normalizedGoal.includes('save') || normalizedGoal.includes('file')) {
      return ActionIntent.WRITE_FILE;
    }
    if (normalizedGoal.includes('http') || normalizedGoal.includes('api') || normalizedGoal.includes('request')) {
      return ActionIntent.CALL_EXTERNAL_API;
    }
    return ActionIntent.READ_FILE;
  }

  protected buildToolInput(
    toolName: string,
    actionPrompt: string,
    researchSummary: string,
    overrides?: Record<string, unknown>
  ): Record<string, unknown> {
    const preferredResearchSource = this.selectPreferredResearchSource();
    switch (toolName) {
      case 'read_local_file':
        return { path: 'package.json', goal: this.context.goal, researchSummary, actionPrompt };
      case 'list_directory':
        return { path: '.', goal: this.context.goal, researchSummary, actionPrompt };
      case 'write_local_file':
        return {
          path: 'data/generated/executor-output.txt',
          content: `目标：${this.context.goal}\n研究摘要：${researchSummary}\n动作：${actionPrompt}`
        };
      case 'plan_data_report_structure':
        return {
          goal: this.context.goal,
          taskContext: this.context.taskContext,
          baseDir: 'src',
          ...overrides
        };
      case 'generate_data_report_module':
        return {
          goal: this.context.goal,
          taskContext: this.context.taskContext,
          baseDir: 'src',
          moduleId: overrides?.moduleId ?? 'Overview'
        };
      case 'generate_data_report_scaffold':
        return {
          goal: this.context.goal,
          taskContext: this.context.taskContext,
          baseDir: 'src',
          ...overrides
        };
      case 'generate_data_report_routes':
        return {
          blueprint: overrides?.blueprint
        };
      case 'assemble_data_report_bundle':
        return {
          blueprint: overrides?.blueprint,
          moduleResults: overrides?.moduleResults,
          sharedFiles: overrides?.sharedFiles,
          routeFiles: overrides?.routeFiles
        };
      case 'write_data_report_bundle':
        return {
          bundle: overrides?.bundle,
          targetRoot: 'data/generated/data-report-output'
        };
      case 'delete_local_file':
        return {
          path: 'data/generated/executor-output.txt',
          recursive: false,
          goal: this.context.goal,
          researchSummary,
          actionPrompt
        };
      case 'schedule_task':
        return {
          name: 'runtime-followup',
          prompt: actionPrompt,
          schedule: 'manual',
          status: 'ACTIVE',
          cwd: '.',
          goal: this.context.goal,
          researchSummary,
          actionPrompt
        };
      case 'http_request':
        return { url: 'https://example.com', method: 'GET', goal: this.context.goal, researchSummary, actionPrompt };
      case 'webSearchPrime':
        return {
          query: this.context.goal,
          goal: this.context.goal,
          researchSummary,
          actionPrompt,
          freshnessHint: isLikelyFreshnessSensitive(this.context.goal) ? 'latest' : 'general'
        };
      case 'webReader':
        return {
          url: preferredResearchSource?.sourceUrl ?? buildSearchUrl(this.context.goal),
          goal: this.context.goal,
          researchSummary,
          actionPrompt
        };
      case 'search_doc':
        return {
          repoUrl: preferredResearchSource?.sourceUrl ?? 'https://github.com/',
          query: this.context.goal,
          goal: this.context.goal,
          researchSummary,
          actionPrompt
        };
      case 'collect_research_source':
        return {
          url: preferredResearchSource?.sourceUrl ?? buildSearchUrl(this.context.goal),
          goal: this.context.goal,
          researchSummary,
          actionPrompt,
          trustClass: preferredResearchSource?.trustClass ?? 'official',
          sourceType: preferredResearchSource?.sourceType ?? 'web'
        };
      case 'browse_page':
        return {
          url: preferredResearchSource?.sourceUrl ?? buildSearchUrl(this.context.goal),
          goal: this.context.goal,
          researchSummary,
          actionPrompt
        };
      case 'run_terminal':
        return { command: 'pnpm exec vitest --help', goal: this.context.goal, researchSummary, actionPrompt };
      case 'ship_release':
        return { target: 'main', goal: this.context.goal, researchSummary, actionPrompt };
      default:
        return { goal: this.context.goal, researchSummary, actionPrompt };
    }
  }

  protected buildApprovalPreview(toolName: string, input: Record<string, unknown>) {
    const preview = [
      typeof input.command === 'string' ? { label: 'Command', value: input.command } : null,
      typeof input.path === 'string' ? { label: 'Path', value: input.path } : null,
      typeof input.schedule === 'string' ? { label: 'Schedule', value: input.schedule } : null,
      typeof input.url === 'string' ? { label: 'URL', value: input.url } : null,
      typeof input.target === 'string' ? { label: 'Target', value: input.target } : null,
      typeof input.targetRoot === 'string' ? { label: 'Target Root', value: input.targetRoot } : null,
      typeof input.method === 'string' ? { label: 'Method', value: input.method } : null,
      typeof input.actionPrompt === 'string' ? { label: 'Action', value: input.actionPrompt } : null,
      !('command' in input) && !('path' in input) && !('url' in input) && !('target' in input)
        ? { label: 'Tool', value: toolName }
        : null
    ].filter(Boolean) as Array<{ label: string; value: string }>;

    return preview.slice(0, 4);
  }

  protected selectPreferredToolNameByWorkflow(): string | undefined {
    switch (this.context.workflowPreset?.id) {
      case 'browse':
        return this.selectPreferredBrowseToolName();
      case 'ship':
        return 'ship_release';
      case 'qa':
        return 'run_terminal';
      case 'data-report':
        return 'plan_data_report_structure';
      default:
        return undefined;
    }
  }

  protected selectPreferredResearchSource() {
    const candidates = (this.context.externalSources ?? []).filter(source => source.sourceUrl);
    return (
      candidates.find(source => source.sourceType === 'web_research_plan') ??
      candidates.find(source => source.trustClass === 'official') ??
      candidates[0]
    );
  }

  protected selectPreferredBrowseToolName() {
    const preferredSource = this.selectPreferredResearchSource();
    const sourceUrl = preferredSource?.sourceUrl?.toLowerCase();

    if (sourceUrl?.includes('github.com') && this.context.mcpClientManager?.hasCapability('search_doc')) {
      return 'search_doc';
    }
    if (sourceUrl && this.context.mcpClientManager?.hasCapability('webReader')) {
      return 'webReader';
    }
    if (this.context.mcpClientManager?.hasCapability('webSearchPrime')) {
      return 'webSearchPrime';
    }
    return this.context.toolRegistry.get('webSearchPrime') ? 'webSearchPrime' : 'collect_research_source';
  }

  protected async maybeReadSearchResult(
    toolName: string,
    executionResult: ToolExecutionResult,
    researchSummary: string,
    actionPrompt: string
  ): Promise<ToolExecutionResult> {
    if (toolName !== 'webSearchPrime') {
      return executionResult;
    }

    const candidate = this.findReadableSearchCandidate(executionResult.rawOutput);
    if (!candidate) {
      return executionResult;
    }

    const followupToolName = this.resolveFollowupBrowseToolName(candidate.url);
    if (!followupToolName) {
      return executionResult;
    }

    const followupRequest = {
      taskId: this.context.taskId,
      toolName: followupToolName,
      intent: ActionIntent.READ_FILE,
      input:
        followupToolName === 'search_doc'
          ? {
              repoUrl: candidate.url,
              query: this.context.goal,
              goal: this.context.goal,
              researchSummary,
              actionPrompt
            }
          : {
              url: candidate.url,
              goal: this.context.goal,
              researchSummary,
              actionPrompt
            },
      requestedBy: 'agent' as const
    };

    const followupResult = this.context.mcpClientManager
      ? await this.context.mcpClientManager.invokeCapability(followupToolName, followupRequest)
      : await this.context.sandbox.execute(followupRequest);

    return {
      ...followupResult,
      outputSummary: `${executionResult.outputSummary}；${followupResult.outputSummary}`,
      rawOutput: mergeExecutionOutputs(executionResult.rawOutput, followupResult.rawOutput, followupToolName)
    };
  }

  protected findReadableSearchCandidate(rawOutput: unknown): { url: string } | undefined {
    if (!rawOutput || typeof rawOutput !== 'object') {
      return undefined;
    }

    const items = Array.isArray((rawOutput as { results?: unknown[] }).results)
      ? (rawOutput as { results: unknown[] }).results
      : Array.isArray((rawOutput as { items?: unknown[] }).items)
        ? (rawOutput as { items: unknown[] }).items
        : [];

    return items.find(item => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const url = typeof (item as { url?: unknown }).url === 'string' ? (item as { url: string }).url : '';
      return Boolean(url) && !isSearchResultUrl(url);
    }) as { url: string } | undefined;
  }

  protected resolveFollowupBrowseToolName(url: string) {
    const normalizedUrl = url.toLowerCase();
    if (normalizedUrl.includes('github.com') && this.context.toolRegistry.get('search_doc')) {
      return 'search_doc';
    }
    if (this.context.toolRegistry.get('webReader')) {
      return 'webReader';
    }
    return undefined;
  }
}

function buildSearchUrl(goal: string) {
  return `https://www.bing.com/search?q=${encodeURIComponent(goal.trim() || '智能搜索')}`;
}

function isLikelyFreshnessSensitive(goal: string) {
  return /(最新|最近|today|latest|recent|本周|今天|近况)/i.test(goal);
}

function isSearchResultUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.host.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    return (
      (host.includes('bing.com') && path.startsWith('/search')) ||
      (host.includes('google.') && path.startsWith('/search')) ||
      (host.includes('duckduckgo.com') && path.startsWith('/')) ||
      (host.includes('baidu.com') && path.startsWith('/s'))
    );
  } catch {
    return true;
  }
}

function mergeExecutionOutputs(primaryRawOutput: unknown, followupRawOutput: unknown, followupToolName: string) {
  const primary =
    primaryRawOutput && typeof primaryRawOutput === 'object' ? (primaryRawOutput as Record<string, unknown>) : {};
  const followup =
    followupRawOutput && typeof followupRawOutput === 'object' ? (followupRawOutput as Record<string, unknown>) : {};
  const primaryResults = Array.isArray(primary.results)
    ? primary.results
    : Array.isArray(primary.items)
      ? primary.items
      : [];

  return {
    ...primary,
    ...followup,
    results: [...primaryResults, followup],
    followedBy: {
      toolName: followupToolName,
      url: typeof followup.url === 'string' ? followup.url : undefined
    }
  };
}
