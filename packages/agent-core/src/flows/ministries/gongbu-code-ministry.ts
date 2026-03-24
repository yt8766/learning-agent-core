import { ActionIntent, AgentExecutionState, AgentRole, ToolDefinition, ToolExecutionResult } from '@agent/shared';

import { AgentRuntimeContext } from '../../runtime/agent-runtime-context';
import { PendingExecutionContext } from '../approval';
import { GONGBU_EXECUTION_SYSTEM_PROMPT } from './gongbu-code/prompts/execution-prompts';
import { ExecutionActionSchema } from './gongbu-code/schemas/execution-action-schema';

export class GongbuCodeMinistry {
  protected readonly state: AgentExecutionState;

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
  }> {
    this.state.status = 'running';
    this.state.subTask = subTask;
    this.state.plan = ['选择动作意图', '从工具注册表解析工具', '在受控环境中执行'];
    this.state.observations = [researchSummary];
    this.state.shortTermMemory = [researchSummary];

    const allowedCapabilities = this.context.workflowPreset?.allowedCapabilities;
    const candidateTools = this.context.toolRegistry
      .list()
      .filter(tool => !allowedCapabilities || allowedCapabilities.includes(tool.name));
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
        llmSelection = await this.context.llm.generateObject(
          [
            {
              role: 'system',
              content: GONGBU_EXECUTION_SYSTEM_PROMPT
            },
            {
              role: 'user',
              content: JSON.stringify({
                goal: this.context.goal,
                researchSummary,
                availableTools
              })
            }
          ],
          ExecutionActionSchema,
          {
            role: 'executor',
            thinking: this.context.thinking.executor,
            temperature: 0.1,
            onUsage: usage => {
              this.context.onUsage?.({
                usage,
                role: 'executor'
              });
            }
          }
        );
      } catch {
        llmSelection = null;
      }
    }

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
    const tool =
      preferredTool ??
      presetTool ??
      (mappedTool && (!allowedCapabilities || allowedCapabilities.includes(mappedTool.name))
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

    const actionPrompt = llmSelection?.actionPrompt ?? `目标：${this.context.goal}；研究摘要：${researchSummary}`;
    this.state.toolCalls.push(`intent:${intent}`, `tool:${tool.name}`);
    this.state.observations.push(
      llmSelection?.rationale ??
        `已选择 ${intent}，对应工具 ${tool.name}。${this.context.workflowPreset ? `当前 Skill：${this.context.workflowPreset.displayName}` : ''}`
    );

    const requiresApproval = this.context.approvalService.requiresApproval(intent, tool);
    if (requiresApproval) {
      this.state.status = 'waiting_approval';
      const summary = `执行已暂停：${intent} 使用 ${tool.name} 需要人工审批。`;
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
      input: this.buildToolInput(tool.name, actionPrompt, researchSummary),
      requestedBy: 'agent' as const
    };

    const executionResult = this.context.mcpClientManager
      ? await this.context.mcpClientManager.invokeCapability(tool.name, request)
      : await this.context.sandbox.execute(request);

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
      summary: executionResult.outputSummary
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
    const normalizedGoal = goal.toLowerCase();
    if (normalizedGoal.includes('write') || normalizedGoal.includes('save') || normalizedGoal.includes('file')) {
      return ActionIntent.WRITE_FILE;
    }
    if (normalizedGoal.includes('http') || normalizedGoal.includes('api') || normalizedGoal.includes('request')) {
      return ActionIntent.CALL_EXTERNAL_API;
    }
    return ActionIntent.READ_FILE;
  }

  protected buildToolInput(toolName: string, actionPrompt: string, researchSummary: string): Record<string, unknown> {
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
      case 'http_request':
        return { url: 'https://example.com', method: 'GET', goal: this.context.goal, researchSummary, actionPrompt };
      case 'browse_page':
        return { url: 'http://localhost:3000', goal: this.context.goal, researchSummary, actionPrompt };
      case 'run_terminal':
        return { command: 'pnpm exec vitest --help', goal: this.context.goal, researchSummary, actionPrompt };
      case 'ship_release':
        return { target: 'main', goal: this.context.goal, researchSummary, actionPrompt };
      default:
        return { goal: this.context.goal, researchSummary, actionPrompt };
    }
  }

  protected selectPreferredToolNameByWorkflow(): string | undefined {
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
}
