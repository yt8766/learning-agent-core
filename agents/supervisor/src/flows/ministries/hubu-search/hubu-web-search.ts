import { ActionIntent, type ToolExecutionResult } from '@agent/core';
import type { EvidenceRecord } from '@agent/core';
import type { ExecutionStepRecord } from '@agent/runtime';

import type { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';

export function buildHubuWebSearchTask(
  context: AgentRuntimeContext,
  knowledgeEvidence: EvidenceRecord[]
): ExecutionStepRecord<Record<string, unknown>, unknown> | undefined {
  const canUseWebSearch =
    context.mcpClientManager?.hasCapability('webSearchPrime') || Boolean(context.toolRegistry?.get?.('webSearchPrime'));
  if (!canUseWebSearch) {
    return undefined;
  }

  return {
    id: 'web-search',
    toolName: 'webSearchPrime',
    source: 'HubuSearchMinistry',
    ministry: context.currentWorker?.ministry,
    inputPreview: { query: context.goal },
    streamingEligible: true,
    expectedSideEffect: 'none',
    tool: {
      name: 'webSearchPrime',
      isReadOnly: true,
      isConcurrencySafe: true,
      isDestructive: false,
      supportsStreamingDispatch: true
    },
    run: async () => {
      const request = {
        taskId: context.taskId,
        toolName: 'webSearchPrime',
        intent: ActionIntent.READ_FILE,
        input: {
          query: context.goal,
          freshnessHint: /(最新|最近|today|latest|recent|本周|今天|近况)/i.test(context.goal) ? 'latest' : 'general'
        },
        requestedBy: 'agent' as const
      };
      const result: ToolExecutionResult = context.mcpClientManager
        ? await context.mcpClientManager.invokeCapability('webSearchPrime', request)
        : await context.sandbox.execute(request);
      const results = Array.isArray((result.rawOutput as { results?: unknown[] } | undefined)?.results)
        ? (result.rawOutput as { results: Array<{ url?: string; title?: string; summary?: string }> }).results
        : [];
      knowledgeEvidence.push(
        ...results
          .filter(item => typeof item.url === 'string')
          .slice(0, 3)
          .map((item, index) => ({
            id: `web:${context.taskId}:${index}`,
            taskId: context.taskId,
            sourceId: item.url!,
            sourceType: 'web',
            sourceUrl: item.url!,
            trustClass: 'unverified' as const,
            summary: item.title ?? '网页搜索结果',
            detail: {
              query: context.goal,
              excerpt: item.summary
            },
            createdAt: new Date().toISOString()
          }))
      );
      return result;
    }
  };
}
