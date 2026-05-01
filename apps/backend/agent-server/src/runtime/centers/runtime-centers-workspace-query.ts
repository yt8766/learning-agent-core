import type { AgentSkillReuseRecord } from '@agent/core';

import type { RuntimeCentersContext } from './runtime-centers.types';
import type { WorkspaceCenterRecord } from './runtime-centers.records';
import type { RuntimeWorkspaceDraftListQuery } from './runtime-centers-workspace-drafts';

type WorkspaceSkillDraftProjection = WorkspaceCenterRecord['skillDrafts'][number];

export interface FilterWorkspaceSkillDraftsByQueryOptions {
  query?: RuntimeWorkspaceDraftListQuery;
  sourceDraftIds?: ReadonlySet<string>;
  sessionTaskIds?: ReadonlySet<string>;
}

export async function loadWorkspaceSkillReuseRecords(
  runtimeStateRepository: RuntimeCentersContext['runtimeStateRepository'] | undefined,
  workspaceId: string
): Promise<AgentSkillReuseRecord[]> {
  if (!runtimeStateRepository) {
    return [];
  }

  const snapshot = await runtimeStateRepository.load();
  return (snapshot.workspaceSkillReuseRecords ?? [])
    .filter(record => record.workspaceId === workspaceId)
    .sort((left, right) => Date.parse(right.reusedAt) - Date.parse(left.reusedAt));
}

export function resolveSessionTaskIds(
  orchestrator: RuntimeCentersContext['orchestrator'] | undefined,
  sessionId: string | undefined
): Set<string> | undefined {
  if (!sessionId) {
    return undefined;
  }

  const tasks = orchestrator?.listTasks?.() ?? [];
  return new Set(
    tasks
      .filter(task => task.sessionId === sessionId)
      .map(task => task.id)
      .filter((taskId): taskId is string => typeof taskId === 'string' && taskId.length > 0)
  );
}

export function filterWorkspaceSkillDraftsByQuery<TDraft extends WorkspaceSkillDraftProjection>(
  drafts: readonly TDraft[],
  options: FilterWorkspaceSkillDraftsByQueryOptions = {}
): TDraft[] {
  const query = options.query ?? {};
  return drafts.filter(
    draft =>
      (!options.sourceDraftIds || options.sourceDraftIds.has(draft.draftId)) &&
      (!query.status || draft.status === query.status) &&
      (!query.sourceTaskId || draft.sourceTaskId === query.sourceTaskId) &&
      (!options.sessionTaskIds || (draft.sourceTaskId ? options.sessionTaskIds.has(draft.sourceTaskId) : false))
  );
}

export function resolveWorkspaceCenterStatus(
  status?: string
): 'idle' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'canceled' {
  if (!status) {
    return 'idle';
  }
  if (status === 'running') {
    return 'running';
  }
  if (status === 'waiting_approval') {
    return 'waiting_approval';
  }
  if (status === 'completed') {
    return 'completed';
  }
  if (status === 'failed') {
    return 'failed';
  }
  if (status === 'cancelled' || status === 'canceled') {
    return 'canceled';
  }
  return 'idle';
}
