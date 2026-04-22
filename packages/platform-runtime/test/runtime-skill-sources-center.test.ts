import { describe, expect, it } from 'vitest';
import { buildSkillSourcesCenter } from '../src/centers/runtime-skill-sources-center';

describe('buildSkillSourcesCenter', () => {
  it('builds installed skill summaries from usage history and receipts', () => {
    const center = buildSkillSourcesCenter({
      sources: [{ id: 'source-1', kind: 'remote', label: 'Remote Skills' } as any],
      manifests: [{ id: 'manifest-1', skillId: 'skill-a' } as any],
      installed: [{ skillId: 'skill-a', installedAt: '2026-04-01T05:00:00.000Z' }],
      receipts: [
        { id: 'receipt-old', installedAt: '2026-03-01T05:00:00.000Z' },
        { id: 'receipt-new', installedAt: '2026-04-01T05:00:00.000Z' }
      ],
      skillCards: [
        {
          id: 'skill-a',
          governanceRecommendation: 'allow',
          allowedTools: ['terminal'],
          compatibility: { profiles: ['personal'] }
        } as any
      ],
      tasks: [
        {
          id: 'task-running',
          goal: 'Audit runtime drift',
          usedInstalledSkills: ['installed-skill:skill-a'],
          updatedAt: '2026-04-03T10:00:00.000Z',
          createdAt: '2026-04-03T09:00:00.000Z',
          status: 'running',
          approvals: [],
          trace: [{ at: '2026-04-03T10:00:00.000Z', summary: 'Checking policies' }]
        },
        {
          id: 'task-completed',
          goal: 'Publish evidence digest',
          usedInstalledSkills: ['installed-skill:skill-a'],
          updatedAt: '2026-04-02T10:00:00.000Z',
          createdAt: '2026-04-02T09:00:00.000Z',
          status: 'completed',
          approvals: [{ decision: 'approved' }],
          trace: [{ at: '2026-04-02T10:00:00.000Z', summary: 'Done' }]
        },
        {
          id: 'task-failed',
          goal: 'Retry connector sync',
          usedInstalledSkills: ['installed-skill:skill-a'],
          updatedAt: '2026-04-01T10:00:00.000Z',
          createdAt: '2026-04-01T09:00:00.000Z',
          status: 'failed',
          result: 'Connector timeout',
          approvals: [],
          trace: [{ at: '2026-04-01T10:00:00.000Z', summary: 'connector error' }]
        }
      ] as any
    });

    expect(center.installed).toHaveLength(1);
    expect(center.installed[0]).toMatchObject({
      skillId: 'skill-a',
      governanceRecommendation: 'allow',
      activeTaskCount: 1,
      totalTaskCount: 3,
      recentTaskGoals: ['Audit runtime drift', 'Publish evidence digest', 'Retry connector sync'],
      firstUsedAt: '2026-04-01T09:00:00.000Z',
      lastUsedAt: '2026-04-03T10:00:00.000Z',
      lastOutcome: undefined,
      recentFailureReason: 'Connector timeout'
    });
    expect(center.installed[0]?.successRate).toBeCloseTo(0.5);
    expect(center.receipts.map(item => item.id)).toEqual(['receipt-new', 'receipt-old']);
  });
});
