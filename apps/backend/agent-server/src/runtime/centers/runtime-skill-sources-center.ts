import { SkillCard, TaskStatus } from '@agent/core';

export function buildSkillSourcesCenter(input: {
  sources: any[];
  manifests: any[];
  installed: any[];
  receipts: any[];
  skillCards: SkillCard[];
  tasks: any[];
}) {
  return {
    sources: input.sources,
    manifests: input.manifests,
    installed: input.installed.map(item => {
      const workerId = `installed-skill:${item.skillId}`;
      const skillCard = input.skillCards.find(skill => skill.id === item.skillId);
      const relatedTasks = input.tasks
        .filter(task => (task.usedInstalledSkills ?? []).includes(workerId))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      const completedTasks = relatedTasks.filter(task =>
        [String(TaskStatus.COMPLETED), String(TaskStatus.FAILED)].includes(String(task.status))
      );
      const successfulTasks = completedTasks.filter(task => String(task.status) === String(TaskStatus.COMPLETED));
      const failedTask = relatedTasks.find(task => String(task.status) === String(TaskStatus.FAILED));
      return {
        ...item,
        governanceRecommendation: skillCard?.governanceRecommendation,
        allowedTools: skillCard?.allowedTools,
        compatibility: skillCard?.compatibility,
        activeTaskCount: relatedTasks.filter(task =>
          ['queued', 'running', 'waiting_approval', 'blocked'].includes(String(task.status))
        ).length,
        totalTaskCount: relatedTasks.length,
        recentTaskGoals: relatedTasks.slice(0, 3).map(task => task.goal),
        firstUsedAt: relatedTasks.length ? relatedTasks[relatedTasks.length - 1]?.createdAt : undefined,
        lastUsedAt: relatedTasks[0]?.updatedAt,
        successRate:
          skillCard?.successRate ??
          (completedTasks.length ? successfulTasks.length / completedTasks.length : undefined),
        lastOutcome:
          relatedTasks.length > 0
            ? String(relatedTasks[0]?.status) === String(TaskStatus.COMPLETED)
              ? 'success'
              : String(relatedTasks[0]?.status) === String(TaskStatus.FAILED)
                ? 'failure'
                : undefined
            : undefined,
        recentFailureReason:
          failedTask?.result ??
          failedTask?.trace.find(
            (trace: any) => /fail|error/i.test(trace.summary ?? '') || /fail|error/i.test(trace.node ?? '')
          )?.summary,
        recentTasks: relatedTasks.slice(0, 3).map(task => ({
          taskId: task.id,
          goal: task.goal,
          status: String(task.status),
          approvalCount: task.approvals?.length ?? 0,
          latestTraceSummary: (task.trace ?? [])[0]?.summary ?? (task.trace ?? [])[0]?.node
        }))
      };
    }),
    receipts: input.receipts.sort((left, right) => (right.installedAt ?? '').localeCompare(left.installedAt ?? ''))
  };
}
