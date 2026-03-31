import { describe, expect, it } from 'vitest';

import type { TaskRecord } from '@agent/shared';

import { buildCitationSourceSummary } from '../../../src/graphs/main/main-graph-knowledge';

describe('buildCitationSourceSummary', () => {
  it('excludes web research plan placeholders and keeps real fetched sources', () => {
    const task = {
      id: 'task_1',
      goal: '核对 GitHub Actions 与 npm 发布流程',
      externalSources: [
        {
          id: 'plan_github',
          taskId: 'task_1',
          sourceType: 'web_research_plan',
          trustClass: 'official',
          summary: 'GitHub 官方文档，优先核对发布、PR 与 Actions 流程。',
          sourceUrl: 'https://docs.github.com/',
          createdAt: '2026-03-29T00:00:00.000Z'
        },
        {
          id: 'plan_npm',
          taskId: 'task_1',
          sourceType: 'web_research_plan',
          trustClass: 'official',
          summary: 'npm 官方文档，优先核对包发布与版本管理流程。',
          sourceUrl: 'https://docs.npmjs.com/',
          createdAt: '2026-03-29T00:00:00.000Z'
        },
        {
          id: 'real_github',
          taskId: 'task_1',
          sourceType: 'web',
          trustClass: 'official',
          summary: 'GitHub Actions 工作流语法',
          sourceUrl: 'https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions',
          createdAt: '2026-03-29T00:00:00.000Z'
        }
      ]
    } satisfies Partial<TaskRecord> as TaskRecord;

    const summary = buildCitationSourceSummary(task);

    expect(summary).toContain('GitHub Actions 工作流语法');
    expect(summary).toContain('docs.github.com');
    expect(summary).not.toContain('优先核对发布、PR 与 Actions 流程');
    expect(summary).not.toContain('优先核对包发布与版本管理流程');
    expect(summary).not.toContain('docs.npmjs.com');
  });
});
