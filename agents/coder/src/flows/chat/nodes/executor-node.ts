import { z } from 'zod/v4';

import { ActionIntent, AgentRole, ToolExecutionResult, type ToolDefinition } from '@agent/core';

type ActionIntentValue = (typeof ActionIntent)[keyof typeof ActionIntent];

import { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import { filterToolsForExecutionMode, isToolAllowedInExecutionMode } from '../../../capabilities/execution-mode-guard';
import { BaseAgent } from '../base-agent';
import {
  buildActionPrompt,
  decorateExecutionSummary,
  resolveInstalledSkillCard,
  resolveRuntimeSkill
} from './executor-node-skill';
import {
  buildApprovalPreview,
  buildToolInput,
  resolveWorkerToolAllowlist,
  selectIntent,
  selectPreferredToolNameByWorkflow
} from './executor-node-tooling';
import { maybeReadSearchResult } from './executor-node-search-followup';

export class ExecutorAgent extends BaseAgent {
  constructor(context: AgentRuntimeContext) {
    super(AgentRole.EXECUTOR, context);
  }

  async run(
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
  }> {
    this.setStatus('running');
    this.setSubTask(subTask);
    this.state.plan = ['选择动作意图', '从工具注册表解析工具', '在受控环境中执行'];
    this.remember(researchSummary);
    const installedSkill = await resolveInstalledSkillCard(this.context);
    const activeSkill = resolveRuntimeSkill(this.context, installedSkill);

    const allowedCapabilities = this.context.workflowPreset?.allowedCapabilities;
    const workerAllowedTools = resolveWorkerToolAllowlist(this.context);
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

    const intent = llmSelection?.intent ?? selectIntent(this.context.goal);
    const presetPreferredToolName = selectPreferredToolNameByWorkflow(this.context);
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

    const actionPrompt =
      llmSelection?.actionPrompt ?? buildActionPrompt(this.context, researchSummary, activeSkill, tool.name);
    const toolInput = buildToolInput(this.context, tool.name, actionPrompt, researchSummary, activeSkill);
    this.state.toolCalls.push(`intent:${intent}`, `tool:${tool.name}`);
    this.remember(
      llmSelection?.rationale ??
        `已选择 ${intent}，对应工具 ${tool.name}。${this.context.workflowPreset ? `当前 Skill：${this.context.workflowPreset.displayName}。` : ''}${this.context.currentWorker ? `当前执行官：${this.context.currentWorker.displayName}。` : ''}`
    );

    const toolRoute = this.context.mcpClientManager?.describeToolRoute(tool.name);
    const approvalEvaluation = await this.context.approvalService.evaluateWithClassifier(intent, tool, {
      ...toolInput,
      executionMode: this.context.executionMode,
      currentMinistry: this.context.currentWorker?.ministry,
      currentWorker: this.context.currentWorker?.id,
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
        approvalPreview: buildApprovalPreview(tool.name, toolInput),
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
    if (
      executionResult.errorMessage === 'watchdog_timeout' ||
      executionResult.errorMessage === 'watchdog_interaction_required'
    ) {
      this.setStatus('waiting_approval');
      const summary = `执行已暂停：${tool.name} 命中兵部看门狗，需要人工干预。${executionResult.outputSummary}`;
      this.state.finalOutput = summary;
      return {
        intent,
        toolName: tool.name,
        tool,
        requiresApproval: true,
        summary,
        serverId: toolRoute?.serverId,
        capabilityId: toolRoute?.capabilityId,
        approvalPreview: buildApprovalPreview(tool.name, toolInput),
        approvalReason: executionResult.outputSummary,
        approvalReasonCode: executionResult.errorMessage
      };
    }
    const enrichedExecution = await maybeReadSearchResult({
      context: this.context,
      toolName: tool.name,
      executionResult,
      researchSummary,
      actionPrompt
    });

    const summarizedOutput = decorateExecutionSummary(enrichedExecution.outputSummary, activeSkill);
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
}
