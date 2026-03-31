import { z } from 'zod/v4';

import { ActionIntent, AgentRole, SkillCard, ToolDefinition, ToolExecutionResult } from '@agent/shared';

import { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import { filterToolsForExecutionMode, isToolAllowedInExecutionMode } from '../../../capabilities/execution-mode-guard';
import { BaseAgent } from '../base-agent';

type RuntimeSkillContract = {
  id: string;
  name: string;
  description?: string;
  steps: SkillCard['steps'];
  constraints: string[];
  successSignals: string[];
  requiredTools?: string[];
  requiredConnectors?: string[];
  approvalSensitiveTools?: string[];
};

export class ExecutorAgent extends BaseAgent {
  constructor(context: AgentRuntimeContext) {
    super(AgentRole.EXECUTOR, context);
  }

  async run(
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
    this.setStatus('running');
    this.setSubTask(subTask);
    this.state.plan = ['选择动作意图', '从工具注册表解析工具', '在受控环境中执行'];
    this.remember(researchSummary);
    const installedSkill = await this.resolveInstalledSkillCard();
    const activeSkill = this.resolveRuntimeSkill(installedSkill);

    const allowedCapabilities = this.context.workflowPreset?.allowedCapabilities;
    const workerAllowedTools = this.resolveWorkerToolAllowlist();
    const candidateTools = filterToolsForExecutionMode(
      this.context.toolRegistry
        .list()
        .filter(
          tool =>
            (!allowedCapabilities || allowedCapabilities.includes(tool.name)) &&
            (!workerAllowedTools || workerAllowedTools.has(tool.name))
        ),
      this.context.executionMode
    );
    const availableTools = candidateTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      riskLevel: tool.riskLevel,
      requiresApproval: tool.requiresApproval
    }));

    const executionSchema = z.object({
      intent: z.enum([
        ActionIntent.READ_FILE,
        ActionIntent.WRITE_FILE,
        ActionIntent.DELETE_FILE,
        ActionIntent.SCHEDULE_TASK,
        ActionIntent.CALL_EXTERNAL_API
      ]),
      toolName: z.string(),
      rationale: z.string(),
      actionPrompt: z.string()
    });

    const llmSelection = await this.generateObject(
      [
        {
          role: 'system',
          content:
            '你是执行 Agent。请始终使用中文，优先选择安全、只读、与目标最贴近的工具；只能从给定注册表中选工具。若目标偏聊天或角色设定，也应先偏向无副作用方案。'
        },
        {
          role: 'user',
          content: JSON.stringify({
            goal: this.context.goal,
            researchSummary,
            availableTools,
            currentWorker: this.context.currentWorker
              ? {
                  id: this.context.currentWorker.id,
                  displayName: this.context.currentWorker.displayName,
                  supportedCapabilities: this.context.currentWorker.supportedCapabilities
                }
              : undefined,
            installedSkill: activeSkill
              ? {
                  id: activeSkill.id,
                  name: activeSkill.name,
                  description: activeSkill.description,
                  steps: activeSkill.steps,
                  constraints: activeSkill.constraints,
                  successSignals: activeSkill.successSignals
                }
              : undefined
          })
        }
      ],
      executionSchema,
      {
        role: 'executor',
        thinking: this.context.thinking.executor
      }
    );

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
    const isWorkerAllowed = (toolName?: string) => !toolName || !workerAllowedTools || workerAllowedTools.has(toolName);
    const tool =
      (preferredTool && isWorkerAllowed(preferredTool.name) ? preferredTool : undefined) ??
      (presetTool && isWorkerAllowed(presetTool.name) ? presetTool : undefined) ??
      (mappedTool &&
      (!allowedCapabilities || allowedCapabilities.includes(mappedTool.name)) &&
      isToolAllowedInExecutionMode(mappedTool, this.context.executionMode) &&
      isWorkerAllowed(mappedTool.name)
        ? mappedTool
        : undefined) ??
      fallbackTool;

    if (!tool) {
      this.setStatus('failed');
      const summary = '执行 Agent 无法在当前 Skill 的能力白名单内解析出可用工具。';
      this.state.finalOutput = summary;
      return {
        intent,
        toolName: 'unresolved_tool',
        requiresApproval: false,
        summary
      };
    }

    const actionPrompt = llmSelection?.actionPrompt ?? this.buildActionPrompt(researchSummary, activeSkill, tool.name);
    const toolInput = this.buildToolInput(tool.name, actionPrompt, researchSummary, activeSkill);
    this.state.toolCalls.push(`intent:${intent}`, `tool:${tool.name}`);
    this.remember(
      llmSelection?.rationale ??
        `已选择 ${intent}，对应工具 ${tool.name}。${this.context.workflowPreset ? `当前 Skill：${this.context.workflowPreset.displayName}。` : ''}${this.context.currentWorker ? `当前执行官：${this.context.currentWorker.displayName}。` : ''}`
    );

    const toolRoute = this.context.mcpClientManager?.describeToolRoute(tool.name);
    const approvalEvaluation = this.context.approvalService.evaluate(intent, tool, {
      ...toolInput,
      serverId: toolRoute?.serverId,
      capabilityId: toolRoute?.capabilityId
    });
    const requiresApproval = toolRoute?.requiresApproval ?? approvalEvaluation.requiresApproval;
    if (requiresApproval) {
      this.setStatus('waiting_approval');
      const routeHint = toolRoute ? ` 当前连接器：${toolRoute.serverId}。` : '';
      const summary = `执行已暂停：${intent} 使用 ${tool.name} 需要人工审批。${routeHint}${approvalEvaluation.reason}`;
      this.state.finalOutput = summary;
      return {
        intent,
        toolName: tool.name,
        tool,
        requiresApproval: true,
        summary,
        serverId: toolRoute?.serverId,
        capabilityId: toolRoute?.capabilityId,
        approvalPreview: this.buildApprovalPreview(tool.name, toolInput),
        approvalReason: approvalEvaluation.reason,
        approvalReasonCode: toolRoute?.requiresApproval
          ? 'requires_approval_tool_policy'
          : approvalEvaluation.reasonCode
      };
    }

    const request = {
      taskId: this.context.taskId,
      toolName: tool.name,
      intent,
      input: toolInput,
      requestedBy: 'agent' as const
    };

    const executionResult = this.context.mcpClientManager
      ? await this.context.mcpClientManager.invokeTool(tool.name, request)
      : await this.context.sandbox.execute(request);
    const enrichedExecution = await this.maybeReadSearchResult(
      tool.name,
      executionResult,
      researchSummary,
      actionPrompt
    );

    const summarizedOutput = this.decorateExecutionSummary(enrichedExecution.outputSummary, activeSkill);
    this.remember(summarizedOutput);
    this.state.finalOutput = summarizedOutput;
    this.setStatus('completed');
    return {
      intent,
      toolName: tool.name,
      tool,
      requiresApproval: false,
      executionResult: enrichedExecution,
      summary: summarizedOutput
    };
  }

  private resolveWorkerToolAllowlist(): Set<string> | undefined {
    const capabilities = this.context.currentWorker?.supportedCapabilities;
    if (!capabilities?.length) {
      return undefined;
    }

    const toolNames = new Set<string>();
    for (const capability of capabilities) {
      const normalized = capability.toLowerCase();
      switch (normalized) {
        case 'search_memory':
        case 'memory':
          toolNames.add('search_memory');
          break;
        case 'read_local_file':
        case 'code-generation':
        case 'documentation':
        case 'ui-spec':
          toolNames.add('read_local_file');
          break;
        case 'list_directory':
        case 'knowledge-synthesis':
          toolNames.add('list_directory');
          toolNames.add('local-analysis');
          toolNames.add('find-skills');
          toolNames.add('webSearchPrime');
          toolNames.add('webReader');
          toolNames.add('search_doc');
          toolNames.add('collect_research_source');
          break;
        case 'write_local_file':
        case 'refactor':
          toolNames.add('write_local_file');
          break;
        case 'delete_local_file':
        case 'delete':
        case 'cleanup':
          toolNames.add('delete_local_file');
          break;
        case 'schedule_task':
        case 'schedule':
        case 'cron':
        case 'timer':
          toolNames.add('schedule_task');
          break;
        case 'http_request':
        case 'release-ops':
          toolNames.add('http_request');
          toolNames.add('ship_release');
          break;
        case 'terminal':
        case 'sandbox':
          toolNames.add('run_terminal');
          break;
        case 'review':
        case 'security-scan':
        case 'compliance':
          toolNames.add('local-analysis');
          toolNames.add('read_local_file');
          break;
        default:
          if (normalized.includes('browse') || normalized.includes('browser')) {
            toolNames.add('browse_page');
          }
          if (normalized.includes('openapi') || normalized.includes('docs')) {
            toolNames.add('read_local_file');
            toolNames.add('local-analysis');
          }
          if (normalized.includes('skill')) {
            toolNames.add('find-skills');
          }
          if (normalized.includes('knowledge')) {
            toolNames.add('search_memory');
            toolNames.add('webSearchPrime');
            toolNames.add('webReader');
            toolNames.add('search_doc');
            toolNames.add('collect_research_source');
          }
          if (normalized.includes('web') || normalized.includes('search')) {
            toolNames.add('webSearchPrime');
            toolNames.add('webReader');
          }
          break;
      }
    }

    return toolNames.size ? toolNames : undefined;
  }

  private selectIntent(goal: string): ActionIntent {
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

  private buildToolInput(
    toolName: string,
    actionPrompt: string,
    researchSummary: string,
    installedSkill?: RuntimeSkillContract
  ): Record<string, unknown> {
    const preferredResearchSource = this.selectPreferredResearchSource();
    const skillEnvelope = installedSkill
      ? {
          skillId: installedSkill.id,
          skillName: installedSkill.name,
          successSignals: installedSkill.successSignals,
          constraints: installedSkill.constraints
        }
      : undefined;

    switch (toolName) {
      case 'read_local_file':
        return { path: 'package.json', goal: this.context.goal, researchSummary, actionPrompt, skill: skillEnvelope };
      case 'list_directory':
        return { path: '.', goal: this.context.goal, researchSummary, actionPrompt, skill: skillEnvelope };
      case 'write_local_file':
        return {
          path: 'data/generated/executor-output.txt',
          content: `目标：${this.context.goal}\n研究摘要：${researchSummary}\n动作：${actionPrompt}`,
          skill: skillEnvelope
        };
      case 'delete_local_file':
        return {
          path: 'data/generated/executor-output.txt',
          recursive: false,
          goal: this.context.goal,
          researchSummary,
          actionPrompt,
          skill: skillEnvelope
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
          actionPrompt,
          skill: skillEnvelope
        };
      case 'http_request':
        return {
          url: 'https://example.com',
          method: 'GET',
          goal: this.context.goal,
          researchSummary,
          actionPrompt,
          skill: skillEnvelope
        };
      case 'webSearchPrime':
        return {
          query: this.context.goal,
          goal: this.context.goal,
          researchSummary,
          actionPrompt,
          freshnessHint: isLikelyFreshnessSensitive(this.context.goal) ? 'latest' : 'general',
          skill: skillEnvelope
        };
      case 'webReader':
        return {
          url: preferredResearchSource?.sourceUrl ?? buildSearchUrl(this.context.goal),
          goal: this.context.goal,
          researchSummary,
          actionPrompt,
          skill: skillEnvelope
        };
      case 'search_doc':
        return {
          repoUrl: preferredResearchSource?.sourceUrl ?? 'https://github.com/',
          query: this.context.goal,
          goal: this.context.goal,
          researchSummary,
          actionPrompt,
          skill: skillEnvelope
        };
      case 'collect_research_source':
        return {
          url: preferredResearchSource?.sourceUrl ?? buildSearchUrl(this.context.goal),
          goal: this.context.goal,
          researchSummary,
          actionPrompt,
          trustClass: preferredResearchSource?.trustClass ?? 'official',
          sourceType: preferredResearchSource?.sourceType ?? 'web',
          skill: skillEnvelope
        };
      case 'browse_page':
        return {
          url: preferredResearchSource?.sourceUrl ?? buildSearchUrl(this.context.goal),
          goal: this.context.goal,
          researchSummary,
          actionPrompt,
          skill: skillEnvelope
        };
      case 'run_terminal': {
        const command = installedSkill?.successSignals.some(signal => signal.toLowerCase().includes('ship'))
          ? 'pnpm build:lib'
          : 'pnpm exec vitest --help';
        return { command, goal: this.context.goal, researchSummary, actionPrompt, skill: skillEnvelope };
      }
      case 'find-skills':
        return { goal: this.context.goal, limit: 8, researchSummary, actionPrompt, skill: skillEnvelope };
      case 'ship_release':
        return { target: 'main', goal: this.context.goal, researchSummary, actionPrompt, skill: skillEnvelope };
      default:
        return { goal: this.context.goal, researchSummary, actionPrompt, skill: skillEnvelope };
    }
  }

  private buildApprovalPreview(toolName: string, input: Record<string, unknown>) {
    const preview = [
      typeof input.command === 'string' ? { label: 'Command', value: input.command } : null,
      typeof input.path === 'string' ? { label: 'Path', value: input.path } : null,
      typeof input.schedule === 'string' ? { label: 'Schedule', value: input.schedule } : null,
      typeof input.url === 'string' ? { label: 'URL', value: input.url } : null,
      typeof input.target === 'string' ? { label: 'Target', value: input.target } : null,
      typeof input.method === 'string' ? { label: 'Method', value: input.method } : null,
      typeof input.actionPrompt === 'string' ? { label: 'Action', value: input.actionPrompt } : null,
      !('command' in input) && !('path' in input) && !('url' in input) && !('target' in input)
        ? { label: 'Tool', value: toolName }
        : null
    ].filter(Boolean) as Array<{ label: string; value: string }>;

    return preview.slice(0, 4);
  }

  private selectPreferredToolNameByWorkflow(): string | undefined {
    switch (this.context.workflowPreset?.id) {
      case 'browse':
        return this.selectPreferredBrowseToolName();
      case 'ship':
        return 'ship_release';
      case 'qa':
        return 'run_terminal';
      default:
        return undefined;
    }
  }

  private selectPreferredResearchSource() {
    const candidates = (this.context.externalSources ?? []).filter(source => source.sourceUrl);
    return (
      candidates.find(source => source.sourceType === 'web_research_plan') ??
      candidates.find(source => source.trustClass === 'official') ??
      candidates[0]
    );
  }

  private selectPreferredBrowseToolName() {
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

  private async resolveInstalledSkillCard(): Promise<SkillCard | undefined> {
    const workerId = this.context.currentWorker?.id;
    if (!workerId?.startsWith('installed-skill:')) {
      return undefined;
    }
    return this.context.skillRegistry.getById(workerId.replace('installed-skill:', ''));
  }

  private resolveRuntimeSkill(installedSkill?: SkillCard): RuntimeSkillContract | undefined {
    if (installedSkill) {
      return {
        id: installedSkill.id,
        name: installedSkill.name,
        description: installedSkill.description,
        steps: installedSkill.steps,
        constraints: installedSkill.constraints,
        successSignals: installedSkill.successSignals,
        requiredTools: installedSkill.requiredTools,
        requiredConnectors: installedSkill.requiredConnectors,
        approvalSensitiveTools: installedSkill.toolContract?.approvalSensitive
      };
    }
    const compiled = this.context.compiledSkill;
    if (!compiled) {
      return undefined;
    }
    return {
      id: compiled.id,
      name: compiled.name,
      description: compiled.description,
      steps: compiled.steps,
      constraints: compiled.constraints ?? [],
      successSignals: compiled.successSignals ?? [],
      requiredTools: compiled.requiredTools,
      requiredConnectors: compiled.requiredConnectors,
      approvalSensitiveTools: compiled.approvalSensitiveTools
    };
  }

  private buildActionPrompt(
    researchSummary: string,
    installedSkill: RuntimeSkillContract | undefined,
    toolName: string
  ): string {
    const basePrompt = `目标：${this.context.goal}；研究摘要：${researchSummary}`;
    if (!installedSkill) {
      return basePrompt;
    }

    const matchedStep = installedSkill.steps.find(step => step.toolNames.includes(toolName)) ?? installedSkill.steps[0];
    const stepText = matchedStep ? `技能步骤：${matchedStep.title}，${matchedStep.instruction}` : '';
    const constraintText = installedSkill.constraints.length ? `约束：${installedSkill.constraints.join('；')}` : '';
    const signalText = installedSkill.successSignals.length
      ? `成功信号：${installedSkill.successSignals.join('、')}`
      : '';
    return [basePrompt, `已命中安装技能：${installedSkill.name}`, stepText, constraintText, signalText]
      .filter(Boolean)
      .join('；');
  }

  private decorateExecutionSummary(summary: string, installedSkill?: RuntimeSkillContract): string {
    if (!installedSkill) {
      return summary;
    }
    return `[${installedSkill.name}] ${summary}`;
  }

  private async maybeReadSearchResult(
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
      ? await this.context.mcpClientManager.invokeTool(followupToolName, followupRequest)
      : await this.context.sandbox.execute(followupRequest);

    return {
      ...followupResult,
      outputSummary: `${executionResult.outputSummary}；${followupResult.outputSummary}`,
      rawOutput: mergeExecutionOutputs(executionResult.rawOutput, followupResult.rawOutput, followupToolName)
    };
  }

  private findReadableSearchCandidate(rawOutput: unknown): { url: string } | undefined {
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

  private resolveFollowupBrowseToolName(url: string) {
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
