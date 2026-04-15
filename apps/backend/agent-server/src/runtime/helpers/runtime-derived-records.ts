import { SessionCoordinator } from '@agent/runtime';
import { ChatCheckpointRecord, SkillCard, TaskRecord } from '@agent/shared';
import { RuntimeStateSnapshot } from '@agent/memory';

import { buildAgentErrorDiagnosisHint, buildAgentErrorRecoveryPlaybook } from './runtime-agent-errors';

type GovernanceAuditRecord = NonNullable<RuntimeStateSnapshot['governanceAudit']>[number];
type DiscoveryRecord = NonNullable<
  NonNullable<RuntimeStateSnapshot['governance']>['connectorDiscoveryHistory']
>[number];

export function buildRuleCandidates(tasks: TaskRecord[]) {
  const grouped = new Map<
    string,
    {
      errorCode: string;
      ministry: string;
      toolName?: string;
      count: number;
      tasks: TaskRecord[];
      notes: string[];
      provenance: NonNullable<TaskRecord['externalSources']>;
    }
  >();

  for (const task of tasks) {
    const diagnosisEvidence = (task.externalSources ?? []).filter(source => source.sourceType === 'diagnosis_result');
    const agentErrors = (task.trace ?? [])
      .filter(trace => trace.node === 'agent_error')
      .map(trace => (trace.data ?? {}) as Record<string, unknown>);
    for (const detail of agentErrors) {
      const errorCode = typeof detail.errorCode === 'string' ? detail.errorCode : 'agent_runtime_error';
      const ministry =
        typeof detail.ministry === 'string' ? detail.ministry : String(task.currentMinistry ?? 'unknown');
      const toolName = typeof detail.toolName === 'string' ? detail.toolName : undefined;
      const key = [errorCode, ministry, toolName ?? 'none'].join('::');
      const current = grouped.get(key) ?? {
        errorCode,
        ministry,
        toolName,
        count: 0,
        tasks: [],
        notes: [],
        provenance: []
      };
      current.count += 1;
      current.tasks.push(task);
      current.notes.push(
        buildAgentErrorDiagnosisHint({
          errorCode,
          errorCategory: typeof detail.errorCategory === 'string' ? detail.errorCategory : 'runtime',
          ministry,
          toolName,
          retryable: Boolean(detail.retryable)
        })
      );
      current.provenance.push(...diagnosisEvidence);
      grouped.set(key, current);
    }
  }

  return Array.from(grouped.entries())
    .filter(([, item]) => item.count >= 2)
    .map(([fingerprint, item]) => {
      const latestTask = item.tasks
        .slice()
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0]!;
      const now = latestTask.updatedAt;
      return {
        id: `rule_candidate:${fingerprint}`,
        taskId: latestTask.id,
        type: 'rule' as const,
        summary: `建议为 ${item.ministry} / ${item.errorCode} 建立恢复规则`,
        status: 'pending_confirmation' as const,
        confidenceScore: Math.min(95, 50 + item.count * 10),
        autoConfirmEligible: false,
        provenance: item.provenance,
        payload: {
          id: `rule:${fingerprint}`,
          name: `${item.ministry} ${item.errorCode} Recovery Rule`,
          summary: `当 ${item.ministry} 再次命中 ${item.errorCode} 时，优先复用既有恢复步骤与诊断建议。`,
          conditions: [
            `ministry=${item.ministry}`,
            `errorCode=${item.errorCode}`,
            item.toolName ? `toolName=${item.toolName}` : undefined
          ].filter(Boolean),
          action: buildAgentErrorRecoveryPlaybook({
            errorCode: item.errorCode,
            errorCategory: 'runtime',
            ministry: item.ministry,
            toolName: item.toolName,
            retryable: true
          }).join('；'),
          sourceTaskId: latestTask.id,
          createdAt: now
        },
        taskGoal: latestTask.goal,
        currentMinistry: item.ministry,
        currentWorker: latestTask.currentWorker,
        provenanceCount: item.provenance.length,
        evaluationScore: latestTask.learningEvaluation?.score,
        evaluationConfidence: latestTask.learningEvaluation?.confidence,
        createdAt: now
      };
    });
}

export function buildCheckpointRef(
  sessionCoordinator: Pick<SessionCoordinator, 'getCheckpoint'>,
  sessionId?: string
):
  | {
      sessionId: string;
      taskId?: string;
      checkpointId?: string;
      checkpointCursor?: number;
      recoverability: ChatCheckpointRecord['recoverability'];
    }
  | undefined {
  if (!sessionId) {
    return undefined;
  }
  const checkpoint = sessionCoordinator.getCheckpoint(sessionId);
  if (!checkpoint) {
    return undefined;
  }
  return {
    sessionId,
    taskId: checkpoint.taskId,
    checkpointId: checkpoint.checkpointId,
    checkpointCursor: checkpoint.traceCursor,
    recoverability: checkpoint.recoverability ?? 'partial'
  };
}

export function groupConnectorDiscoveryHistory(history: DiscoveryRecord[]) {
  const grouped = new Map<string, DiscoveryRecord[]>();
  for (const entry of history.slice().sort((left, right) => right.discoveredAt.localeCompare(left.discoveredAt))) {
    const items = grouped.get(entry.connectorId) ?? [];
    items.push(entry);
    grouped.set(entry.connectorId, items);
  }
  return grouped;
}

export function groupGovernanceAuditByTarget(history: GovernanceAuditRecord[]) {
  const grouped = new Map<string, GovernanceAuditRecord[]>();
  for (const entry of history) {
    if (entry.scope !== 'connector') {
      continue;
    }
    const items = grouped.get(entry.targetId) ?? [];
    items.push(entry);
    grouped.set(entry.targetId, items);
  }
  return grouped;
}

export function defaultConnectorSessionState(transport?: 'http' | 'stdio' | 'local-adapter') {
  if (transport === 'stdio') {
    return 'disconnected' as const;
  }
  return 'stateless' as const;
}

export function buildInstalledSkillTags(skill: SkillCard): string[] {
  const tags = new Set<string>();
  skill.name
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
    .filter(Boolean)
    .forEach(tag => tags.add(tag));
  skill.applicableGoals.forEach(goal =>
    goal
      .toLowerCase()
      .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
      .filter(token => token.length >= 2)
      .slice(0, 6)
      .forEach(token => tags.add(token))
  );
  return Array.from(tags);
}
