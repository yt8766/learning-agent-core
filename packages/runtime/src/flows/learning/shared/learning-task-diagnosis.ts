import type { RuntimeTaskRecord as TaskRecord } from '../../../runtime/runtime-task.types';

export function isDiagnosisTask(task: Pick<TaskRecord, 'goal' | 'context'>): boolean {
  const normalizedGoal = String(task.goal ?? '')
    .trim()
    .toLowerCase();
  const normalizedContext = String(task.context ?? '')
    .trim()
    .toLowerCase();
  return (
    normalizedContext.includes('diagnosis_for:') ||
    normalizedGoal.includes('请诊断任务') ||
    normalizedGoal.includes('agent 错误') ||
    normalizedGoal.includes('恢复方案') ||
    normalizedGoal.includes('diagnose task')
  );
}
