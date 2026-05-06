import type { ContextBundle, ContextManifest, ContextPage } from '@agent/core';

export interface AssembleAgentRuntimeContextInput {
  taskId: string;
  agentId: string;
  bundleId: string;
  createdAt: string;
  profile: {
    readableKinds: string[];
    maxContextTokens: number;
  };
  candidates: ContextPage[];
}

export interface AssembleAgentRuntimeContextResult {
  bundle: ContextBundle;
  manifest: ContextManifest;
}

export function assembleAgentRuntimeContext(
  input: AssembleAgentRuntimeContextInput
): AssembleAgentRuntimeContextResult {
  let tokenTotal = 0;
  const loaded: ContextPage[] = [];
  const omitted: ContextManifest['omittedPages'] = [];

  for (const candidate of input.candidates) {
    if (!input.profile.readableKinds.includes(candidate.kind)) {
      omitted.push({ pageId: candidate.id, reason: 'permission_denied' });
      continue;
    }

    if (candidate.trustLevel === 'low') {
      omitted.push({ pageId: candidate.id, reason: 'low_trust' });
      continue;
    }

    if (candidate.freshness === 'stale') {
      omitted.push({ pageId: candidate.id, reason: 'stale' });
      continue;
    }

    if (tokenTotal + candidate.tokenCost > input.profile.maxContextTokens) {
      omitted.push({ pageId: candidate.id, reason: 'token_budget' });
      continue;
    }

    tokenTotal += candidate.tokenCost;
    loaded.push(candidate);
  }

  return {
    bundle: {
      bundleId: input.bundleId,
      taskId: input.taskId,
      agentId: input.agentId,
      pages: loaded
    },
    manifest: {
      bundleId: input.bundleId,
      taskId: input.taskId,
      agentId: input.agentId,
      createdAt: input.createdAt,
      loadedPages: loaded.map(page => ({
        pageId: page.id,
        kind: page.kind,
        reason: 'Allowed by profile and token budget',
        tokenCost: page.tokenCost,
        authority: page.authority,
        trustLevel: page.trustLevel
      })),
      omittedPages: omitted,
      totalTokenCost: tokenTotal
    }
  };
}
