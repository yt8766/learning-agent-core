import { ActionIntent } from '@agent/core';

import type { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import type { ToolDefinition } from '@agent/runtime';

type ActionIntentValue = (typeof ActionIntent)[keyof typeof ActionIntent];

export async function evaluateGongbuApprovalGate(
  context: AgentRuntimeContext,
  intent: ActionIntentValue,
  tool: ToolDefinition,
  toolInput: Record<string, unknown>
) {
  return context.approvalService.evaluateWithClassifier(intent, tool, {
    ...toolInput,
    executionMode: context.executionMode,
    currentMinistry: context.currentWorker?.ministry,
    currentWorker: context.currentWorker?.id
  });
}

export function buildGongbuApprovalPreview(toolName: string, input: Record<string, unknown>) {
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
