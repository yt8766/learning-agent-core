import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  getInterruptStatusSummary,
  getRuntimeDrawerExportFilters,
  getRuntimeDrawerExportScopeCopy
} from '@/features/runtime-panel/chat-runtime-drawer';
import { WorkflowRolesCard } from '@/features/runtime-panel/chat-runtime-drawer-cards';
import { buildPendingPlanQuestionCheckpoint } from '../../fixtures/chat-session-fixtures';

describe('chat-runtime-drawer helpers', () => {
  it('formats plan-question interrupt summary', () => {
    expect(getInterruptStatusSummary(buildPendingPlanQuestionCheckpoint())).toContain('计划提问');
  });

  it('derives export filters from checkpoint state', () => {
    expect(getRuntimeDrawerExportFilters(buildPendingPlanQuestionCheckpoint())).toEqual({
      executionMode: 'plan',
      interactionKind: 'plan-question'
    });
  });

  it('describes export scope using current checkpoint filters', () => {
    expect(getRuntimeDrawerExportScopeCopy(buildPendingPlanQuestionCheckpoint())).toContain('执行边界：计划模式');
  });

  it('renders governance and critic summaries without leaking raw blocking issue details', () => {
    const checkpoint = {
      ...buildPendingPlanQuestionCheckpoint(),
      currentMinistry: 'xingbu-review',
      currentWorker: 'worker-xingbu',
      criticState: {
        decision: 'rewrite_required',
        summary: '批判层要求先回流调度链修订。',
        blockingIssues: ['internal raw critique detail'],
        updatedAt: '2026-03-31T00:00:00.000Z'
      },
      governanceReport: {
        summary: '治理链建议保守提升信任。',
        reviewOutcome: {
          decision: 'pass',
          summary: '终审通过。'
        },
        evidenceSufficiency: {
          score: 88,
          summary: '证据充分。'
        },
        sandboxReliability: {
          score: 90,
          summary: 'sandbox 稳定。'
        }
      }
    } as any;

    const html = renderToStaticMarkup(
      <WorkflowRolesCard checkpoint={checkpoint} routeReason="test" getAgentLabel={role => role ?? '--'} />
    );

    expect(html).toContain('治理报告摘要');
    expect(html).toContain('批判层：rewrite_required');
    expect(html).not.toContain('internal raw critique detail');
  });
});
