import { describe, expect, it } from 'vitest';

import { decideAlertsNode } from '../../../src/flows/intel/nodes/decide-alerts';
import { dedupeAndMergeNode } from '../../../src/flows/intel/nodes/dedupe-and-merge';
import { scoreSignalNode } from '../../../src/flows/intel/nodes/score-signal';

describe('signal decision nodes', () => {
  it('upgrades a pending duplicate into a confirmed merged signal', () => {
    const mergedState = dedupeAndMergeNode({
      existingSignals: [
        {
          id: 'signal_001',
          dedupeKey: 'frontend_security:axios:vulnerability:2026-04-23',
          category: 'frontend_security',
          eventType: 'security_advisory',
          title: 'Axios security advisory',
          summary: 'Axios 发布了安全公告',
          priority: 'P1',
          confidence: 'low',
          status: 'pending',
          firstSeenAt: '2026-04-23T10:00:00.000Z',
          lastSeenAt: '2026-04-23T10:01:00.000Z'
        }
      ],
      incomingSignals: [
        {
          id: 'signal_002',
          dedupeKey: 'frontend_security:axios:vulnerability:2026-04-23',
          category: 'frontend_security',
          eventType: 'security_advisory',
          title: 'Axios security advisory',
          summary: 'Axios confirmed the security advisory',
          priority: 'P1',
          confidence: 'low',
          status: 'confirmed',
          firstSeenAt: '2026-04-23T10:00:00.000Z',
          lastSeenAt: '2026-04-23T10:05:00.000Z'
        }
      ]
    });

    expect(mergedState.mergedSignals).toEqual([
      {
        id: 'signal_001',
        dedupeKey: 'frontend_security:axios:vulnerability:2026-04-23',
        category: 'frontend_security',
        eventType: 'security_advisory',
        title: 'Axios security advisory',
        summary: 'Axios confirmed the security advisory',
        priority: 'P1',
        confidence: 'low',
        status: 'confirmed',
        firstSeenAt: '2026-04-23T10:00:00.000Z',
        lastSeenAt: '2026-04-23T10:05:00.000Z'
      }
    ]);
  });

  it('scores security and release signals with different priority and confidence levels', () => {
    const scoredState = scoreSignalNode({
      mergedSignals: [
        {
          id: 'signal_001',
          dedupeKey: 'frontend_security:axios:vulnerability:2026-04-23',
          category: 'frontend_security',
          eventType: 'security_advisory',
          title: 'Axios security advisory',
          summary: 'Axios 发布了安全公告',
          priority: 'P1',
          confidence: 'low',
          status: 'pending',
          firstSeenAt: '2026-04-23T10:00:00.000Z',
          lastSeenAt: '2026-04-23T10:01:00.000Z'
        },
        {
          id: 'signal_002',
          dedupeKey: 'ai_release:openai:release:2026-04-23',
          category: 'ai_release',
          eventType: 'release',
          title: 'Model release announcement',
          summary: 'A new model release was announced',
          priority: 'P2',
          confidence: 'low',
          status: 'pending',
          firstSeenAt: '2026-04-23T11:00:00.000Z',
          lastSeenAt: '2026-04-23T11:01:00.000Z'
        }
      ]
    });

    expect(scoredState.scoredSignals).toEqual([
      {
        id: 'signal_001',
        dedupeKey: 'frontend_security:axios:vulnerability:2026-04-23',
        category: 'frontend_security',
        eventType: 'security_advisory',
        title: 'Axios security advisory',
        summary: 'Axios 发布了安全公告',
        priority: 'P0',
        confidence: 'high',
        status: 'confirmed',
        firstSeenAt: '2026-04-23T10:00:00.000Z',
        lastSeenAt: '2026-04-23T10:01:00.000Z'
      },
      {
        id: 'signal_002',
        dedupeKey: 'ai_release:openai:release:2026-04-23',
        category: 'ai_release',
        eventType: 'release',
        title: 'Model release announcement',
        summary: 'A new model release was announced',
        priority: 'P1',
        confidence: 'medium',
        status: 'pending',
        firstSeenAt: '2026-04-23T11:00:00.000Z',
        lastSeenAt: '2026-04-23T11:01:00.000Z'
      }
    ]);
  });

  it('decides alert kind and status from the scored signal severity', () => {
    const alertsState = decideAlertsNode({
      scoredSignals: [
        {
          id: 'signal_001',
          dedupeKey: 'frontend_security:axios:vulnerability:2026-04-23',
          category: 'frontend_security',
          eventType: 'security_advisory',
          title: 'Axios security advisory',
          summary: 'Axios 发布了安全公告',
          priority: 'P0',
          confidence: 'high',
          status: 'confirmed',
          firstSeenAt: '2026-04-23T10:00:00.000Z',
          lastSeenAt: '2026-04-23T10:01:00.000Z'
        },
        {
          id: 'signal_002',
          dedupeKey: 'frontend_tech:react:release:2026-04-23',
          category: 'frontend_tech',
          eventType: 'release',
          title: 'React release announcement',
          summary: 'React 19 release is available',
          priority: 'P1',
          confidence: 'medium',
          status: 'pending',
          firstSeenAt: '2026-04-23T11:00:00.000Z',
          lastSeenAt: '2026-04-23T11:01:00.000Z'
        },
        {
          id: 'signal_003',
          dedupeKey: 'frontend_tech:minor:update:2026-04-23',
          category: 'frontend_tech',
          eventType: 'update',
          title: 'Minor update',
          summary: 'Small community update',
          priority: 'P2',
          confidence: 'low',
          status: 'pending',
          firstSeenAt: '2026-04-23T12:00:00.000Z',
          lastSeenAt: '2026-04-23T12:01:00.000Z'
        }
      ]
    });

    expect(alertsState.generatedAlerts).toEqual([
      {
        id: 'alert_signal_001',
        signalId: 'signal_001',
        alertLevel: 'P0',
        alertKind: 'formal',
        status: 'ready',
        createdAt: '2026-04-23T10:01:00.000Z',
        updatedAt: '2026-04-23T10:01:00.000Z'
      },
      {
        id: 'alert_signal_002',
        signalId: 'signal_002',
        alertLevel: 'P1',
        alertKind: 'pending',
        status: 'ready',
        createdAt: '2026-04-23T11:01:00.000Z',
        updatedAt: '2026-04-23T11:01:00.000Z'
      },
      {
        id: 'alert_signal_003',
        signalId: 'signal_003',
        alertLevel: 'P2',
        alertKind: 'digest_only',
        status: 'closed',
        createdAt: '2026-04-23T12:01:00.000Z',
        updatedAt: '2026-04-23T12:01:00.000Z'
      }
    ]);
  });
});
