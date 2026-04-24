import { describe, expect, it } from 'vitest';

import { enqueueDeliveriesNode } from '../../../src/flows/intel/nodes/enqueue-deliveries';
import { matchIntelRoutes } from '../../../src/runtime/routing/intel-route-matcher';

describe('matchIntelRoutes', () => {
  it('matches multiple rules and deduplicates channels across the final delivery set', () => {
    const result = matchIntelRoutes({
      signal: {
        id: 'signal_001',
        category: 'frontend_security',
        priority: 'P0',
        status: 'confirmed',
        title: 'axios security advisory'
      },
      routes: {
        defaults: {
          suppressDuplicateHours: 24
        },
        rules: [
          {
            id: 'frontend-security-primary',
            enabled: true,
            when: {
              categoryIn: ['frontend_security'],
              priorityIn: ['P0'],
              statusIn: ['confirmed']
            },
            sendTo: ['security_alert', 'digest_frontend'],
            template: 'security_alert_full'
          },
          {
            id: 'frontend-security-fallback',
            enabled: true,
            when: {
              categoryIn: ['frontend_security'],
              priorityIn: ['P0']
            },
            sendTo: ['security_alert', 'digest_frontend', 'security_alert'],
            template: 'security_alert_brief'
          }
        ]
      }
    });

    expect(result.ruleIds).toEqual(['frontend-security-primary', 'frontend-security-fallback']);
    expect(result.deliveryTargets).toEqual(['security_alert', 'digest_frontend']);
    expect(result.matches[0]?.sendTo).toEqual(['security_alert', 'digest_frontend']);
  });

  it('creates one queued delivery per unique channel and suppresses recent duplicates', () => {
    const result = enqueueDeliveriesNode({
      signalId: 'signal_001',
      now: '2026-04-23T12:00:00.000Z',
      routes: [
        {
          ruleId: 'frontend-security-primary',
          template: 'security_alert_full',
          sendTo: ['security_alert', 'digest_frontend']
        },
        {
          ruleId: 'frontend-security-fallback',
          template: 'security_alert_brief',
          sendTo: ['security_alert', 'digest_frontend']
        }
      ],
      existingDeliveries: [
        {
          id: 'delivery_recent_001',
          signalId: 'signal_001',
          channelTarget: 'security_alert',
          deliveryKind: 'alert',
          deliveryStatus: 'pending',
          createdAt: '2026-04-23T11:30:00.000Z'
        }
      ],
      suppressDuplicateHours: 24
    });

    expect(result.queuedDeliveries).toHaveLength(1);
    expect(result.queuedDeliveries[0]?.channelTarget).toBe('digest_frontend');
    expect(result.skippedTargets).toEqual(['security_alert']);
  });

  it('supports delivery-kind-aware digest routing without matching alert-only rules', () => {
    const result = matchIntelRoutes({
      signal: {
        id: 'signal_digest_001',
        category: 'frontend_tech',
        priority: 'P1',
        status: 'confirmed',
        title: 'React 发布新版本',
        deliveryKind: 'digest'
      },
      routes: {
        defaults: {
          suppressDuplicateHours: 24
        },
        rules: [
          {
            id: 'frontend-alert-only',
            enabled: true,
            when: {
              categoryIn: ['frontend_tech'],
              deliveryKindIn: ['alert']
            },
            sendTo: ['security_alert'],
            template: 'security_alert_full'
          },
          {
            id: 'frontend-digest',
            enabled: true,
            when: {
              categoryIn: ['frontend_tech'],
              deliveryKindIn: ['digest']
            },
            sendTo: ['digest_frontend'],
            template: 'daily_digest'
          }
        ]
      }
    });

    expect(result.ruleIds).toEqual(['frontend-digest']);
    expect(result.deliveryTargets).toEqual(['digest_frontend']);
  });
});
