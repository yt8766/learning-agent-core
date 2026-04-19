import {
  ActionIntent,
  type AgentExecutionState,
  type ToolDefinition,
  type ToolExecutionResult
} from '@agent/core';

import type { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import { evaluateGongbuApprovalGate } from './gongbu-code-approval-gate';
import {
  inspectScaffoldWriteCommand,
  resolveScaffoldIntent,
  resolveScaffoldToolName
} from './gongbu-code-scaffold';

type ActionIntentValue = (typeof ActionIntent)[keyof typeof ActionIntent];

export interface ScaffoldWorkflowDeps {
  executeSingleTool(
    tool: ToolDefinition,
    intent: ActionIntentValue,
    toolInput: Record<string, unknown>
  ): Promise<ToolExecutionResult>;
  buildToolInput(
    toolName: string,
    actionPrompt: string,
    researchSummary: string,
    overrides?: Record<string, unknown>
  ): Record<string, unknown>;
  buildApprovalPreview(
    toolName: string,
    input: Record<string, unknown>
  ): Array<{ label: string; value: string }>;
}

export async function runGongbuScaffoldWorkflow(
  context: AgentRuntimeContext,
  state: AgentExecutionState,
  researchSummary: string,
  deps: ScaffoldWorkflowDeps
): Promise<{
  intent: ActionIntentValue;
  toolName: string;
  requiresApproval: boolean;
  tool?: ToolDefinition;
  executionResult?: ToolExecutionResult;
  summary: string;
  approvalReason?: string;
  approvalReasonCode?: string;
  approvalPreview?: Array<{ label: string; value: string }>;
  toolInput?: Record<string, unknown>;
}> {
  const { executeSingleTool, buildToolInput, buildApprovalPreview } = deps;
  let toolName: string;
  let intent: ActionIntentValue;
  let toolInput: Record<string, unknown>;

  try {
    toolName = resolveScaffoldToolName(context.goal);
    intent = resolveScaffoldIntent(context.goal);
    toolInput = buildToolInput(toolName, `脚手架流程：${context.goal}`, researchSummary);
  } catch (error) {
    const summary = error instanceof Error ? error.message : '无法解析 /scaffold 命令。';
    state.status = 'failed';
    state.finalOutput = summary;
    return {
      intent: ActionIntent.READ_FILE,
      toolName: 'invalid_scaffold_command',
      requiresApproval: false,
      summary
    };
  }

  const tool = context.toolRegistry.get(toolName);
  if (!tool) {
    const summary = `工部无法找到 /scaffold 所需工具 ${toolName}。`;
    state.status = 'failed';
    state.finalOutput = summary;
    return {
      intent,
      toolName,
      requiresApproval: false,
      summary,
      toolInput
    };
  }

  state.plan = ['解析 /scaffold 命令', '生成脚手架预览或预检', '在需要时执行审批与写入'];
  state.toolCalls.push(`intent:${intent}`, `tool:${tool.name}`);
  state.observations.push(`已进入 ${context.workflowPreset?.displayName ?? '脚手架'} 显式流程。`);

  if (tool.name === 'write_scaffold') {
    const { bundle, inspection } = await inspectScaffoldWriteCommand(context.goal);
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
      state.observations.push(summary);
      state.shortTermMemory = [researchSummary, summary];
      state.finalOutput = summary;
      state.status = 'completed';
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

  const approvalEvaluation = await evaluateGongbuApprovalGate(context, intent, tool, toolInput);
  if (approvalEvaluation.requiresApproval) {
    state.status = 'waiting_approval';
    const summary = `执行已暂停：${intent} 使用 ${tool.name} 需要人工审批。${approvalEvaluation.reason}`;
    state.finalOutput = summary;
    return {
      intent,
      toolName: tool.name,
      tool,
      requiresApproval: true,
      summary,
      toolInput,
      approvalPreview: buildApprovalPreview(tool.name, toolInput),
      approvalReason: approvalEvaluation.reason,
      approvalReasonCode: approvalEvaluation.reasonCode
    };
  }

  const executionResult = await executeSingleTool(tool, intent, toolInput);
  state.observations.push(executionResult.outputSummary);
  state.shortTermMemory = [researchSummary, executionResult.outputSummary];
  state.finalOutput = executionResult.outputSummary;
  state.status = 'completed';

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
