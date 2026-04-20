import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/runtime/helpers/runtime-connector-registry', () => ({
  getDisabledCompanyWorkerIds: vi.fn(() => ['worker-1'])
}));

import {
  loadCompanyAgentView,
  loadCompanyAgentsCenterRecord
} from '../../../../src/runtime/domain/governance/runtime-company-agents-view';

describe('runtime company agents view', () => {
  it('builds company agents center and resolves a single worker view from shared loader', async () => {
    const ctx = {
      orchestrator: {
        listTasks: () => [
          {
            id: 'task-1',
            currentWorker: 'worker-1',
            usedCompanyWorkers: [],
            updatedAt: '2026-04-01T08:00:00.000Z',
            status: 'completed',
            goal: 'Deliver weekly report',
            runId: 'run-1'
          }
        ],
        listWorkers: () => [{ id: 'worker-1', kind: 'company', requiredConnectors: [] }]
      },
      getConnectorRegistryContext: () => ({
        orchestrator: { listWorkers: () => [{ id: 'worker-1', kind: 'company' }] }
      })
    } as any;

    expect(loadCompanyAgentsCenterRecord(ctx)).toEqual([expect.objectContaining({ id: 'worker-1' })]);
    await expect(loadCompanyAgentView(ctx, 'worker-1')).resolves.toEqual(expect.objectContaining({ id: 'worker-1' }));
  });
});
