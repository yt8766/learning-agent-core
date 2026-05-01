import { describe, expect, it, vi } from 'vitest';

import {
  buildCapabilityTrustProfiles,
  queuePriorityScore,
  summarizeCounselorExperiments,
  toGovernanceProfileSummary
} from '../src/centers/runtime-learning-center.helpers';

describe('runtime-learning-center helpers', () => {
  it('scores high priority queues above normal priority', () => {
    expect(queuePriorityScore('high')).toBe(2);
    expect(queuePriorityScore('normal')).toBe(1);
    expect(queuePriorityScore(undefined)).toBe(1);
  });

  it('summarizes counselor experiments from task and queue fallbacks', () => {
    const result = summarizeCounselorExperiments(
      [
        {
          id: 'task-1',
          status: 'completed',
          interruptHistory: [{ id: 'int-1' }],
          critiqueResult: { decision: 'block' },
          llmUsage: { totalTokens: 300 },
          budgetState: { costConsumedUsd: 0.6 },
          executionPlan: {
            selectedCounselorId: 'selector-a',
            selectedVersion: 'v2'
          }
        },
        {
          id: 'task-2',
          status: 'running',
          interruptHistory: [],
          entryDecision: {
            counselorSelector: {
              selectedCounselorId: 'selector-a',
              selectedVersion: 'v2'
            }
          },
          llmUsage: { totalTokens: 100 },
          budgetState: { costConsumedUsd: 0.1 }
        },
        {
          id: 'task-3',
          status: 'completed',
          interruptHistory: [{ id: 'int-2' }, { id: 'int-3' }],
          critiqueResult: { decision: 'pass' }
        }
      ] as any,
      [
        {
          taskId: 'task-2',
          selectedCounselorId: 'selector-a',
          selectedVersion: 'v2',
          capabilityUsageStats: {
            totalTokens: 400,
            totalCostUsd: 1.2
          }
        },
        {
          taskId: 'task-3',
          selectedCounselorId: 'selector-b',
          capabilityUsageStats: {
            totalTokens: 90,
            totalCostUsd: 0.3
          }
        }
      ]
    );

    expect(result).toEqual([
      {
        selectedCounselorId: 'selector-a',
        selectedVersion: 'v2',
        taskCount: 2,
        successRate: 0.5,
        interruptRate: 0.5,
        blockedRate: 0.5,
        avgTokens: 350,
        avgCostUsd: 0.8999999999999999
      },
      {
        selectedCounselorId: 'selector-b',
        selectedVersion: 'unversioned',
        taskCount: 1,
        successRate: 1,
        interruptRate: 2,
        blockedRate: 0,
        avgTokens: 90,
        avgCostUsd: 0.3
      }
    ]);
  });

  it('maps governance profiles without altering the source shape', () => {
    expect(
      toGovernanceProfileSummary({
        entityId: 'libu-governance',
        displayName: '礼部',
        entityKind: 'ministry',
        trustLevel: 'high',
        trustTrend: 'up',
        lastReason: '长期稳定',
        reportCount: 4,
        promoteCount: 3,
        holdCount: 1,
        downgradeCount: 0,
        lastTaskId: 'task-1',
        lastReviewDecision: 'pass',
        updatedAt: '2026-04-08T10:00:00.000Z'
      })
    ).toEqual({
      entityId: 'libu-governance',
      displayName: '礼部',
      entityKind: 'ministry',
      trustLevel: 'high',
      trustTrend: 'up',
      lastReason: '长期稳定',
      reportCount: 4,
      promoteCount: 3,
      holdCount: 1,
      downgradeCount: 0,
      lastTaskId: 'task-1',
      lastReviewDecision: 'pass',
      updatedAt: '2026-04-08T10:00:00.000Z'
    });
  });

  it('prefers persisted capability profiles and otherwise falls back to attachment summaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-08T18:20:00.000Z'));

    const fallback = buildCapabilityTrustProfiles(
      [
        {
          capabilityAttachments: [
            {
              id: 'cap-1',
              displayName: 'Capability One',
              capabilityTrust: {
                trustLevel: 'medium',
                trustTrend: 'steady',
                lastReason: 'observed',
                updatedAt: '2026-04-08T10:00:00.000Z'
              },
              governanceProfile: {
                reportCount: 2,
                promoteCount: 1,
                holdCount: 1,
                downgradeCount: 0,
                lastTaskId: 'task-1',
                lastReviewDecision: 'pass',
                updatedAt: '2026-04-08T10:00:00.000Z'
              },
              updatedAt: '2026-04-08T09:00:00.000Z'
            },
            {
              id: 'cap-1',
              displayName: 'Capability One',
              capabilityTrust: {
                trustLevel: 'high',
                trustTrend: 'up',
                lastReason: 'promoted',
                updatedAt: '2026-04-08T12:00:00.000Z'
              },
              governanceProfile: {
                reportCount: 3,
                promoteCount: 2,
                holdCount: 1,
                downgradeCount: 0,
                lastTaskId: 'task-2',
                lastReviewDecision: 'pass',
                updatedAt: '2026-04-08T12:00:00.000Z'
              },
              updatedAt: '2026-04-08T11:00:00.000Z'
            },
            {
              id: 'cap-2',
              displayName: 'Capability Two',
              updatedAt: '2026-04-08T08:00:00.000Z'
            }
          ]
        }
      ] as any,
      []
    );

    expect(fallback).toEqual([
      expect.objectContaining({
        capabilityId: 'cap-1',
        displayName: 'Capability One',
        trustLevel: 'high',
        trustTrend: 'up',
        reportCount: 3
      }),
      expect.objectContaining({
        capabilityId: 'cap-2',
        displayName: 'Capability Two',
        trustLevel: 'medium',
        trustTrend: 'steady',
        updatedAt: '2026-04-08T08:00:00.000Z'
      })
    ]);

    const persisted = buildCapabilityTrustProfiles(
      [] as any,
      [
        {
          capabilityId: 'persisted-cap',
          displayName: 'Persisted Capability',
          trustLevel: 'low',
          trustTrend: 'down',
          reportCount: 9,
          promoteCount: 1,
          holdCount: 3,
          downgradeCount: 5,
          updatedAt: '2026-04-08T17:00:00.000Z'
        }
      ] as any
    );

    expect(persisted).toEqual([
      expect.objectContaining({
        capabilityId: 'persisted-cap',
        displayName: 'Persisted Capability',
        trustLevel: 'low',
        trustTrend: 'down',
        reportCount: 9
      })
    ]);

    vi.useRealTimers();
  });
});
