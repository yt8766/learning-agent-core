import { describe, expect, it } from 'vitest';

import { IntelAlertSchema, IntelDeliverySchema, IntelSignalSchema } from '@agent/agents-intel-engine';

describe('@agent/agents-intel-engine intel contracts', () => {
  it('parses the minimal signal, alert, and delivery records', () => {
    const signal = IntelSignalSchema.parse({
      id: 'signal_001',
      dedupeKey: 'frontend_security:axios:advisory:2026-04-23',
      category: 'frontend_security',
      eventType: 'security_advisory',
      title: 'axios security advisory',
      summary: 'axios 发布了安全修复公告',
      priority: 'P0',
      confidence: 'high',
      status: 'confirmed',
      firstSeenAt: '2026-04-23T10:00:00.000Z',
      lastSeenAt: '2026-04-23T10:00:00.000Z'
    });

    const alert = IntelAlertSchema.parse({
      id: 'alert_001',
      signalId: signal.id,
      alertLevel: 'P0',
      alertKind: 'formal',
      status: 'ready',
      createdAt: '2026-04-23T10:01:00.000Z',
      updatedAt: '2026-04-23T10:01:00.000Z'
    });

    const delivery = IntelDeliverySchema.parse({
      id: 'delivery_001',
      signalId: signal.id,
      alertId: alert.id,
      channelType: 'lark',
      channelTarget: 'security_alert',
      deliveryKind: 'alert',
      deliveryStatus: 'pending',
      retryCount: 0,
      createdAt: '2026-04-23T10:02:00.000Z'
    });

    expect(signal.category).toBe('frontend_security');
    expect(alert.alertKind).toBe('formal');
    expect(delivery.channelTarget).toBe('security_alert');
  });
});
