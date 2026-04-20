import { describe, expect, it } from 'vitest';

import type { EvidenceRecord, MemoryEventRecord, MemoryRecord } from '@agent/core';
import type { RuntimeStateSnapshot } from '@agent/memory';
import { applyCrossCheckEvidenceRecords, buildMemoryUsageInsights, buildMemoryVersionComparison } from '@agent/memory';

describe('memory governance insights', () => {
  it('builds memory usage insights from stable memory records', () => {
    const memories: MemoryRecord[] = [
      {
        id: 'memory-1',
        summary: 'alpha',
        content: 'alpha content',
        createdAt: '2026-04-01T00:00:00.000Z',
        memoryType: 'fact',
        status: 'active',
        usageMetrics: {
          retrievedCount: 5,
          injectedCount: 4,
          adoptedCount: 3,
          dismissedCount: 1,
          correctedCount: 0
        }
      },
      {
        id: 'memory-2',
        summary: 'beta',
        content: 'beta content',
        createdAt: '2026-04-02T00:00:00.000Z',
        memoryType: 'preference',
        status: 'retired',
        usageMetrics: {
          retrievedCount: 2,
          injectedCount: 2,
          adoptedCount: 1,
          dismissedCount: 0,
          correctedCount: 1
        }
      }
    ];

    expect(buildMemoryUsageInsights(memories)).toMatchObject({
      totalMemories: 2,
      totalRetrieved: 7,
      totalInjected: 6,
      totalAdopted: 4,
      totalDismissed: 1,
      totalCorrected: 1,
      adoptionRate: 0.6667,
      adoptionByMemoryType: [
        { memoryType: 'fact', adoptedCount: 3 },
        { memoryType: 'preference', adoptedCount: 1 }
      ],
      countByStatus: [
        { status: 'active', count: 1 },
        { status: 'retired', count: 1 }
      ]
    });
    expect(buildMemoryUsageInsights(memories).topAdoptedMemories[0]).toMatchObject({ id: 'memory-1', value: 3 });
  });

  it('compares current and historical memory snapshots', () => {
    const current: MemoryRecord = {
      id: 'memory-1',
      summary: 'current summary',
      content: 'current content',
      createdAt: '2026-04-03T00:00:00.000Z',
      version: 3,
      status: 'active',
      memoryType: 'fact',
      scopeType: 'project',
      sourceEvidenceIds: ['e-current']
    };
    const events: MemoryEventRecord[] = [
      {
        id: 'event-1',
        memoryId: 'memory-1',
        version: 1,
        type: 'memory.created',
        payload: {
          snapshot: {
            summary: 'first summary',
            content: 'first content',
            status: 'active',
            memoryType: 'fact',
            scopeType: 'project',
            sourceEvidenceIds: ['e-first']
          }
        },
        createdAt: '2026-04-01T00:00:00.000Z'
      },
      {
        id: 'event-2',
        memoryId: 'memory-1',
        version: 2,
        type: 'memory.updated',
        payload: {
          snapshot: {
            summary: 'second summary',
            content: 'second content',
            status: 'active',
            memoryType: 'fact',
            scopeType: 'project',
            sourceEvidenceIds: ['e-second']
          }
        },
        createdAt: '2026-04-02T00:00:00.000Z'
      }
    ];

    expect(
      buildMemoryVersionComparison({
        memoryId: 'memory-1',
        history: {
          memory: current,
          events
        },
        leftVersion: 2,
        rightVersion: 3
      })
    ).toEqual(
      expect.objectContaining({
        memoryId: 'memory-1',
        currentVersion: 3,
        leftVersion: 2,
        rightVersion: 3,
        latestEventType: 'memory.updated',
        left: expect.objectContaining({
          summary: 'second summary',
          sourceEvidenceIds: ['e-second']
        }),
        right: expect.objectContaining({
          summary: 'current summary',
          sourceEvidenceIds: ['e-current']
        })
      })
    );
  });

  it('dedupes and trims cross-check evidence records', () => {
    const snapshot = {
      tasks: [],
      learningJobs: [],
      pendingExecutions: [],
      channelDeliveries: [],
      chatSessions: [],
      chatMessages: [],
      chatEvents: [],
      chatCheckpoints: [],
      crossCheckEvidence: Array.from({ length: 199 }, (_, index) => ({
        memoryId: `memory-${index}`,
        record: {
          id: `record-${index}`,
          taskId: `task-${index}`,
          sourceType: 'official_rule',
          trustClass: 'official',
          summary: `summary-${index}`,
          createdAt: `2026-04-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`
        } satisfies EvidenceRecord
      }))
    } satisfies RuntimeStateSnapshot;

    const records: EvidenceRecord[] = [
      {
        id: 'record-10',
        taskId: 'task-10',
        sourceType: 'official_rule',
        trustClass: 'official',
        summary: 'updated',
        createdAt: '2026-04-10T00:00:00.000Z'
      },
      {
        id: 'record-new',
        taskId: 'task-new',
        sourceType: 'official_rule',
        trustClass: 'official',
        summary: 'new',
        createdAt: '2026-04-30T00:00:00.000Z'
      }
    ];

    const next = applyCrossCheckEvidenceRecords(snapshot, 'memory-target', records);

    expect(next.crossCheckEvidence).toHaveLength(200);
    expect(next.crossCheckEvidence?.find(item => item.record.id === 'record-10')).toEqual({
      memoryId: 'memory-target',
      record: records[0]
    });
    expect(next.crossCheckEvidence?.find(item => item.record.id === 'record-new')).toEqual({
      memoryId: 'memory-target',
      record: records[1]
    });
  });
});
