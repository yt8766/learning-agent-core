import { ActionIntent } from '@agent/core';

import type { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import type { ToolDefinition, ToolExecutionResult } from '@agent/runtime';

type ActionIntentValue = (typeof ActionIntent)[keyof typeof ActionIntent];

export async function executeGongbuToolRequest(
  context: AgentRuntimeContext,
  tool: ToolDefinition,
  intent: ActionIntentValue,
  toolInput: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const request = {
    taskId: context.taskId,
    toolName: tool.name,
    intent,
    input: toolInput,
    requestedBy: 'agent' as const
  };

  return context.mcpClientManager
    ? await context.mcpClientManager.invokeCapability(tool.name, request)
    : await context.sandbox.execute(request);
}

export async function maybeReadGongbuSearchResult(params: {
  context: AgentRuntimeContext;
  toolName: string;
  executionResult: ToolExecutionResult;
  researchSummary: string;
  actionPrompt: string;
}) {
  if (params.toolName !== 'webSearchPrime') {
    return params.executionResult;
  }

  const candidate = findReadableSearchCandidate(params.executionResult.rawOutput);
  if (!candidate) {
    return params.executionResult;
  }

  const followupToolName = resolveFollowupBrowseToolName(params.context, candidate.url);
  if (!followupToolName) {
    return params.executionResult;
  }

  const followupRequest = {
    taskId: params.context.taskId,
    toolName: followupToolName,
    intent: ActionIntent.READ_FILE,
    input:
      followupToolName === 'search_doc'
        ? {
            repoUrl: candidate.url,
            query: params.context.goal,
            goal: params.context.goal,
            researchSummary: params.researchSummary,
            actionPrompt: params.actionPrompt
          }
        : {
            url: candidate.url,
            goal: params.context.goal,
            researchSummary: params.researchSummary,
            actionPrompt: params.actionPrompt
          },
    requestedBy: 'agent' as const
  };

  const followupResult = params.context.mcpClientManager
    ? await params.context.mcpClientManager.invokeCapability(followupToolName, followupRequest)
    : await params.context.sandbox.execute(followupRequest);

  return {
    ...followupResult,
    outputSummary: `${params.executionResult.outputSummary}；${followupResult.outputSummary}`,
    rawOutput: mergeExecutionOutputs(params.executionResult.rawOutput, followupResult.rawOutput, followupToolName)
  };
}

function findReadableSearchCandidate(rawOutput: unknown): { url: string } | undefined {
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

function resolveFollowupBrowseToolName(context: AgentRuntimeContext, url: string) {
  const normalizedUrl = url.toLowerCase();
  if (normalizedUrl.includes('github.com') && context.toolRegistry.get('search_doc')) {
    return 'search_doc';
  }
  if (context.toolRegistry.get('webReader')) {
    return 'webReader';
  }
  return undefined;
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
