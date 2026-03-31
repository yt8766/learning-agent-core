import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RuntimeSummaryOverview } from '@/features/runtime-overview/components/runtime-summary-overview';

describe('RuntimeSummaryOverview render smoke', () => {
  it('renders registry cards and policy summary', () => {
    const html = renderToStaticMarkup(
      <RuntimeSummaryOverview
        runtime={
          {
            runtimeProfile: 'platform',
            activeTaskCount: 4,
            taskCount: 12,
            queueDepth: 2,
            blockedRunCount: 1,
            budgetExceededCount: 0,
            pendingApprovalCount: 3,
            activeSessionCount: 2,
            sessionCount: 5,
            interruptTimeoutCount: 1,
            waitingInterruptAverageMinutes: 4.5,
            recentAgentErrors: [{ message: 'provider timeout' }],
            diagnosisEvidenceCount: 2,
            activeMinistries: ['gongbu-code', 'xingbu-review'],
            activeWorkers: ['gongbu-code', 'xingbu-review'],
            backgroundRunCount: 1,
            foregroundRunCount: 2,
            leasedBackgroundRunCount: 1,
            staleLeaseCount: 0,
            activeWorkerSlotCount: 3,
            workerPoolSize: 8,
            availableWorkerSlotCount: 5,
            policy: {
              approvalMode: 'balanced',
              skillInstallMode: 'manual',
              learningMode: 'governed',
              sourcePolicyMode: 'controlled-first',
              budget: { stepBudget: 10, retryBudget: 3, sourceBudget: 6 }
            },
            subgraphs: [
              {
                id: 'graph-main',
                displayName: '主图',
                description: '处理首辅七节点主链',
                owner: 'supervisor',
                entryNodes: ['entry_router']
              }
            ],
            workflowVersions: [
              {
                workflowId: 'general-collab',
                version: 3,
                status: 'active',
                updatedAt: '2026-03-30T10:00:00.000Z',
                changelog: ['mode-gate', 'context-filter']
              }
            ]
          } as any
        }
      />
    );

    expect(html).toContain('Runtime Policy');
    expect(html).toContain('Subgraph Registry');
    expect(html).toContain('Workflow Versions');
    expect(html).toContain('controlled-first');
    expect(html).toContain('graph-main');
    expect(html).toContain('general-collab');
  });
});
