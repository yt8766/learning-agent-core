import { z } from 'zod/v4';

import { ActionIntent, AgentRole, SkillCard, ToolDefinition, ToolExecutionResult } from '@agent/shared';

import { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import { BaseAgent } from '../base-agent';

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
  }> {
    this.setStatus('running');
    this.setSubTask(subTask);
    this.state.plan = ['选择动作意图', '从工具注册表解析工具', '在受控环境中执行'];
    this.remember(researchSummary);
    const installedSkill = await this.resolveInstalledSkillCard();

    const allowedCapabilities = this.context.workflowPreset?.allowedCapabilities;
    const workerAllowedTools = this.resolveWorkerToolAllowlist();
    const candidateTools = this.context.toolRegistry
      .list()
      .filter(
        tool =>
          (!allowedCapabilities || allowedCapabilities.includes(tool.name)) &&
          (!workerAllowedTools || workerAllowedTools.has(tool.name))
      );
    const availableTools = candidateTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      riskLevel: tool.riskLevel,
      requiresApproval: tool.requiresApproval
    }));

    const executionSchema = z.object({
      intent: z.enum([ActionIntent.READ_FILE, ActionIntent.WRITE_FILE, ActionIntent.CALL_EXTERNAL_API]),
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
            installedSkill: installedSkill
              ? {
                  id: installedSkill.id,
                  name: installedSkill.name,
                  description: installedSkill.description,
                  steps: installedSkill.steps,
                  constraints: installedSkill.constraints,
                  successSignals: installedSkill.successSignals
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
    const preferredTool =
      llmSelection?.toolName && (!allowedCapabilities || allowedCapabilities.includes(llmSelection.toolName))
        ? this.context.toolRegistry.get(llmSelection.toolName)
        : undefined;
    const presetTool =
      presetPreferredToolName && (!allowedCapabilities || allowedCapabilities.includes(presetPreferredToolName))
        ? this.context.toolRegistry.get(presetPreferredToolName)
        : undefined;
    const mappedTool = this.context.toolRegistry.getForIntent(intent);
    const fallbackTool = candidateTools.find(tool => tool.name === 'local-analysis') ?? candidateTools[0];
    const isWorkerAllowed = (toolName?: string) => !toolName || !workerAllowedTools || workerAllowedTools.has(toolName);
    const tool =
      (preferredTool && isWorkerAllowed(preferredTool.name) ? preferredTool : undefined) ??
      (presetTool && isWorkerAllowed(presetTool.name) ? presetTool : undefined) ??
      (mappedTool &&
      (!allowedCapabilities || allowedCapabilities.includes(mappedTool.name)) &&
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

    const actionPrompt =
      llmSelection?.actionPrompt ?? this.buildActionPrompt(researchSummary, installedSkill, tool.name);
    this.state.toolCalls.push(`intent:${intent}`, `tool:${tool.name}`);
    this.remember(
      llmSelection?.rationale ??
        `已选择 ${intent}，对应工具 ${tool.name}。${this.context.workflowPreset ? `当前 Skill：${this.context.workflowPreset.displayName}。` : ''}${this.context.currentWorker ? `当前执行官：${this.context.currentWorker.displayName}。` : ''}`
    );

    const toolRoute = this.context.mcpClientManager?.describeToolRoute(tool.name);
    const requiresApproval = toolRoute?.requiresApproval ?? this.context.approvalService.requiresApproval(intent, tool);
    if (requiresApproval) {
      this.setStatus('waiting_approval');
      const routeHint = toolRoute ? ` 当前连接器：${toolRoute.serverId}。` : '';
      const summary = `执行已暂停：${intent} 使用 ${tool.name} 需要人工审批。${routeHint}`;
      this.state.finalOutput = summary;
      return {
        intent,
        toolName: tool.name,
        tool,
        requiresApproval: true,
        summary
      };
    }

    const request = {
      taskId: this.context.taskId,
      toolName: tool.name,
      intent,
      input: this.buildToolInput(tool.name, actionPrompt, researchSummary, installedSkill),
      requestedBy: 'agent' as const
    };

    const executionResult = this.context.mcpClientManager
      ? await this.context.mcpClientManager.invokeTool(tool.name, request)
      : await this.context.sandbox.execute(request);

    const summarizedOutput = this.decorateExecutionSummary(executionResult.outputSummary, installedSkill);
    this.remember(summarizedOutput);
    this.state.finalOutput = summarizedOutput;
    this.setStatus('completed');
    return {
      intent,
      toolName: tool.name,
      tool,
      requiresApproval: false,
      executionResult,
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
          toolNames.add('collect_research_source');
          break;
        case 'write_local_file':
        case 'refactor':
          toolNames.add('write_local_file');
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
            toolNames.add('collect_research_source');
          }
          break;
      }
    }

    return toolNames.size ? toolNames : undefined;
  }

  private selectIntent(goal: string): ActionIntent {
    const normalizedGoal = goal.toLowerCase();
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
    installedSkill?: SkillCard
  ): Record<string, unknown> {
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
      case 'http_request':
        return {
          url: 'https://example.com',
          method: 'GET',
          goal: this.context.goal,
          researchSummary,
          actionPrompt,
          skill: skillEnvelope
        };
      case 'browse_page':
        return {
          url: 'http://localhost:3000',
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

  private selectPreferredToolNameByWorkflow(): string | undefined {
    switch (this.context.workflowPreset?.id) {
      case 'browse':
        return 'browse_page';
      case 'ship':
        return 'ship_release';
      case 'qa':
        return 'run_terminal';
      default:
        return undefined;
    }
  }

  private async resolveInstalledSkillCard(): Promise<SkillCard | undefined> {
    const workerId = this.context.currentWorker?.id;
    if (!workerId?.startsWith('installed-skill:')) {
      return undefined;
    }
    return this.context.skillRegistry.getById(workerId.replace('installed-skill:', ''));
  }

  private buildActionPrompt(researchSummary: string, installedSkill: SkillCard | undefined, toolName: string): string {
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

  private decorateExecutionSummary(summary: string, installedSkill?: SkillCard): string {
    if (!installedSkill) {
      return summary;
    }
    return `[${installedSkill.name}] ${summary}`;
  }
}
