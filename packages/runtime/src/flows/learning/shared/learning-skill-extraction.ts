import type { EvaluationResult } from '@agent/knowledge';

import type { RuntimeTaskRecord as TaskRecord } from '../../../runtime/runtime-task.types';

export function shouldExtractSkillForTask(
  task: Pick<TaskRecord, 'goal' | 'context' | 'result'>,
  evaluation?: Pick<EvaluationResult, 'shouldExtractSkill'>
) {
  if (!evaluation?.shouldExtractSkill) {
    return false;
  }

  const corpus = `${task.goal ?? ''}\n${task.context ?? ''}\n${task.result ?? ''}`.toLowerCase();
  const blockedPatterns = [
    /周报/,
    /日报/,
    /月报/,
    /年报/,
    /工作总结/,
    /总结一下/,
    /生成.*周报/,
    /撰写.*周报/,
    /写.*周报/,
    /润色/,
    /改写/,
    /翻译/,
    /邮件/,
    /文案/,
    /汇报/,
    /稿子/,
    /草稿/
  ];
  return !blockedPatterns.some(pattern => pattern.test(corpus));
}
