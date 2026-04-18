import { describe, expect, it } from 'vitest';

import {
  inferTrustClass,
  isDiagnosisTask,
  mergeEvidence,
  normalizeInstalledSkillId,
  shouldExtractSkillForTask
} from '../src/flows/learning';

describe('learning flow shared helpers', () => {
  it('detects diagnosis tasks from goal or context', () => {
    expect(isDiagnosisTask({ goal: '请诊断任务失败原因', context: '' })).toBe(true);
    expect(isDiagnosisTask({ goal: '普通任务', context: '' })).toBe(false);
  });

  it('normalizes installed skill ids and dedupes evidence merges', () => {
    expect(normalizeInstalledSkillId('installed-skill:demo')).toBe('demo');
    expect(normalizeInstalledSkillId('demo')).toBe('demo');

    const merged = mergeEvidence(
      [
        {
          id: '1',
          taskId: 'task-1',
          sourceType: 'trace',
          trustClass: 'internal',
          summary: 'same',
          linkedRunId: 'run-1',
          createdAt: '2026-04-18T00:00:00.000Z'
        }
      ],
      [
        {
          id: '2',
          taskId: 'task-1',
          sourceType: 'trace',
          trustClass: 'internal',
          summary: 'same',
          linkedRunId: 'run-1',
          createdAt: '2026-04-18T00:00:00.000Z'
        }
      ]
    );

    expect(merged).toHaveLength(1);
  });

  it('keeps blocked writing-style tasks from being extracted as skills and maps trust classes', () => {
    expect(
      shouldExtractSkillForTask({ goal: '写一份周报', context: '', result: '' }, { shouldExtractSkill: true })
    ).toBe(false);
    expect(
      shouldExtractSkillForTask({ goal: '实现一个执行链路', context: '', result: '' }, { shouldExtractSkill: true })
    ).toBe(true);
    expect(inferTrustClass('https://openai.com/blog')).toBe('official');
    expect(inferTrustClass('https://github.com/openai/openai-node')).toBe('curated');
  });
});
