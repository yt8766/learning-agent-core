import type { EvidenceRecord } from '@agent/core';
import { inferTrustClass, mergeEvidence, normalizeInstalledSkillId } from '@agent/core';

import type { RuntimeTaskRecord as TaskRecord } from '../../../runtime/runtime-task.types';

export { mergeEvidence, inferTrustClass, normalizeInstalledSkillId };

export function deriveEvidence(task: TaskRecord): EvidenceRecord[] {
  const sources = task.trace
    .map((trace, index) => {
      const data = trace.data ?? {};
      const sourceUrl = typeof data.sourceUrl === 'string' ? data.sourceUrl : undefined;
      const sourceType = typeof data.sourceType === 'string' ? data.sourceType : sourceUrl ? 'web' : 'trace';
      const trustClass = sourceUrl ? inferTrustClass(sourceUrl) : ('internal' as const);

      return {
        id: `${task.id}:evidence:${index}`,
        taskId: task.id,
        sourceType,
        sourceUrl,
        trustClass,
        summary: trace.summary,
        detail: data,
        linkedRunId: task.runId,
        createdAt: trace.at
      } satisfies EvidenceRecord;
    })
    .filter((item, index, list) => {
      const key = `${item.sourceType}:${item.sourceUrl ?? item.summary}`;
      return (
        list.findIndex(candidate => `${candidate.sourceType}:${candidate.sourceUrl ?? candidate.summary}` === key) ===
        index
      );
    });

  const installedSkillEvidence = (task.usedInstalledSkills ?? []).map((workerId, index) => ({
    id: `${task.id}:installed-skill:${index}`,
    taskId: task.id,
    sourceId: normalizeInstalledSkillId(workerId),
    sourceType: 'installed_skill',
    trustClass: 'internal' as const,
    summary: `本轮执行命中了已安装技能 ${normalizeInstalledSkillId(workerId)}。`,
    detail: { workerId },
    linkedRunId: task.runId,
    createdAt: task.updatedAt
  }));

  const companyWorkerEvidence = (task.usedCompanyWorkers ?? []).map((workerId, index) => ({
    id: `${task.id}:company-worker:${index}`,
    taskId: task.id,
    sourceId: workerId,
    sourceType: 'company_worker',
    trustClass: 'internal' as const,
    summary: `本轮执行调用了公司专员 ${workerId}。`,
    detail: { workerId },
    linkedRunId: task.runId,
    createdAt: task.updatedAt
  }));

  return [...sources, ...installedSkillEvidence, ...companyWorkerEvidence].slice(-12);
}
