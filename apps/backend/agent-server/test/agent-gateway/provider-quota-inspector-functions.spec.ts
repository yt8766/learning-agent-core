import { describe, expect, it } from 'vitest';

import {
  DeterministicProviderQuotaInspector,
  projectProviderQuotaSnapshot,
  projectProviderQuotaSnapshots,
  type ProviderQuotaSnapshot
} from '../../src/domains/agent-gateway/runtime-engine/accounting/provider-quota-inspector';

const refreshedAt = '2026-05-11T00:00:00.000Z';

function makeSnapshot(overrides: Partial<ProviderQuotaSnapshot> = {}): ProviderQuotaSnapshot {
  return {
    id: 'codex:auth1:model:5h',
    providerKind: 'codex',
    authFileId: 'auth1',
    accountEmail: 'user@example.com',
    model: 'gpt-5-codex',
    scope: 'model',
    window: '5h',
    limit: 100,
    used: 50,
    remaining: 50,
    resetAt: '2026-05-11T05:00:00.000Z',
    refreshedAt,
    status: 'normal',
    source: 'authFile',
    ...overrides
  };
}

describe('projectProviderQuotaSnapshot', () => {
  it('maps snapshot fields to GatewayQuotaDetail', () => {
    const snapshot = makeSnapshot();
    const detail = projectProviderQuotaSnapshot(snapshot);

    expect(detail).toEqual({
      id: 'codex:auth1:model:5h',
      providerId: 'codex',
      model: 'gpt-5-codex',
      scope: 'model',
      window: '5h',
      limit: 100,
      used: 50,
      remaining: 50,
      resetAt: '2026-05-11T05:00:00.000Z',
      refreshedAt,
      status: 'normal'
    });
  });

  it('falls back to accountEmail when model is null', () => {
    const snapshot = makeSnapshot({ model: null, accountEmail: 'fallback@test.com' });
    const detail = projectProviderQuotaSnapshot(snapshot);
    expect(detail.model).toBe('fallback@test.com');
  });

  it('falls back to authFileId when model and accountEmail are null', () => {
    const snapshot = makeSnapshot({ model: null, accountEmail: null });
    const detail = projectProviderQuotaSnapshot(snapshot);
    expect(detail.model).toBe('auth1');
  });

  it('maps null limit to 0', () => {
    const snapshot = makeSnapshot({ limit: null });
    const detail = projectProviderQuotaSnapshot(snapshot);
    expect(detail.limit).toBe(0);
  });

  it('maps null remaining to 0', () => {
    const snapshot = makeSnapshot({ remaining: null });
    const detail = projectProviderQuotaSnapshot(snapshot);
    expect(detail.remaining).toBe(0);
  });

  it('maps unknown status to warning', () => {
    const snapshot = makeSnapshot({ status: 'unknown' });
    const detail = projectProviderQuotaSnapshot(snapshot);
    expect(detail.status).toBe('warning');
  });

  it('maps error status to warning', () => {
    const snapshot = makeSnapshot({ status: 'error' });
    const detail = projectProviderQuotaSnapshot(snapshot);
    expect(detail.status).toBe('warning');
  });

  it('preserves exceeded status as-is', () => {
    const snapshot = makeSnapshot({ status: 'exceeded' });
    const detail = projectProviderQuotaSnapshot(snapshot);
    expect(detail.status).toBe('exceeded');
  });

  it('preserves warning status as-is', () => {
    const snapshot = makeSnapshot({ status: 'warning' });
    const detail = projectProviderQuotaSnapshot(snapshot);
    expect(detail.status).toBe('warning');
  });
});

describe('projectProviderQuotaSnapshots', () => {
  it('maps multiple snapshots to items array', () => {
    const snapshots = [makeSnapshot(), makeSnapshot({ id: 'codex:auth1:model:weekly', window: 'weekly' })];
    const response = projectProviderQuotaSnapshots(snapshots);
    expect(response.items).toHaveLength(2);
    expect(response.items[0].id).toBe('codex:auth1:model:5h');
    expect(response.items[1].id).toBe('codex:auth1:model:weekly');
  });

  it('returns empty items for empty input', () => {
    expect(projectProviderQuotaSnapshots([])).toEqual({ items: [] });
  });
});

describe('DeterministicProviderQuotaInspector', () => {
  it('uses default model when auth file has no models', async () => {
    const inspector = new DeterministicProviderQuotaInspector('codex', {
      now: () => refreshedAt,
      defaultModel: 'gpt-5-codex'
    });

    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'codex',
          status: 'valid',
          models: [],
          quota: { daily: { limit: 100, used: 50, resetAt: '2026-05-12T00:00:00.000Z' } }
        }
      ]
    });

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].model).toBe('gpt-5-codex');
  });

  it('uses default model when auth file has undefined models', async () => {
    const inspector = new DeterministicProviderQuotaInspector('codex', {
      now: () => refreshedAt
    });

    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'codex',
          status: 'valid',
          quota: { daily: { limit: 100, used: 50, resetAt: '2026-05-12T00:00:00.000Z' } }
        }
      ]
    });

    expect(snapshots[0].model).toBe('codex-model');
  });

  it('filters out auth files of different provider kind', async () => {
    const inspector = new DeterministicProviderQuotaInspector('codex', { now: () => refreshedAt });

    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'claude-auth',
          providerKind: 'claude',
          status: 'valid',
          models: ['claude-opus'],
          quota: { daily: { limit: 100, used: 50, resetAt: '2026-05-12T00:00:00.000Z' } }
        }
      ]
    });

    expect(snapshots).toHaveLength(0);
  });

  it('returns unknown snapshot when status is error', async () => {
    const inspector = new DeterministicProviderQuotaInspector('codex', { now: () => refreshedAt });

    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'codex',
          status: 'error',
          error: 'invalid'
        }
      ]
    });

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].status).toBe('unknown');
    expect(snapshots[0].scope).toBe('account');
  });

  it('returns unknown snapshot when quota is missing', async () => {
    const inspector = new DeterministicProviderQuotaInspector('codex', { now: () => refreshedAt });

    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'codex',
          status: 'valid'
        }
      ]
    });

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].status).toBe('unknown');
  });

  it('returns unknown snapshot when quota has no valid windows', async () => {
    const inspector = new DeterministicProviderQuotaInspector('codex', { now: () => refreshedAt });

    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'codex',
          status: 'valid',
          quota: {}
        }
      ]
    });

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].status).toBe('unknown');
  });

  it('handles all quota window types including fiveHour alias', async () => {
    const inspector = new DeterministicProviderQuotaInspector('codex', { now: () => refreshedAt });

    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'codex',
          status: 'valid',
          models: ['gpt-5'],
          quota: {
            fiveHour: { limit: 100, used: 50, resetAt: '2026-05-11T05:00:00.000Z' },
            daily: { limit: 200, used: 100, resetAt: '2026-05-12T00:00:00.000Z' },
            weekly: { limit: 1000, used: 500, resetAt: '2026-05-18T00:00:00.000Z' },
            monthly: { limit: 5000, used: 2500, resetAt: '2026-06-01T00:00:00.000Z' },
            rolling: { limit: 300, used: 150, resetAt: null }
          }
        }
      ]
    });

    expect(snapshots).toHaveLength(5);
    expect(snapshots.map(s => s.window)).toEqual(['5h', 'daily', 'weekly', 'monthly', 'rolling']);
  });

  it('calculates remaining as null when limit is null', async () => {
    const inspector = new DeterministicProviderQuotaInspector('codex', { now: () => refreshedAt });

    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'codex',
          status: 'valid',
          models: ['gpt-5'],
          quota: { daily: { limit: null, used: 50, resetAt: null } }
        }
      ]
    });

    expect(snapshots[0].remaining).toBeNull();
    expect(snapshots[0].status).toBe('unknown');
  });

  it('clamps remaining to zero when used exceeds limit', async () => {
    const inspector = new DeterministicProviderQuotaInspector('codex', { now: () => refreshedAt });

    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'codex',
          status: 'valid',
          models: ['gpt-5'],
          quota: { daily: { limit: 100, used: 150, resetAt: '2026-05-12T00:00:00.000Z' } }
        }
      ]
    });

    expect(snapshots[0].remaining).toBe(0);
    expect(snapshots[0].status).toBe('exceeded');
  });

  it('returns warning status when remaining is 20% or less of limit', async () => {
    const inspector = new DeterministicProviderQuotaInspector('codex', { now: () => refreshedAt });

    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'codex',
          status: 'valid',
          models: ['gpt-5'],
          quota: { daily: { limit: 100, used: 81, resetAt: '2026-05-12T00:00:00.000Z' } }
        }
      ]
    });

    expect(snapshots[0].remaining).toBe(19);
    expect(snapshots[0].status).toBe('warning');
  });

  it('expands multiple models into separate snapshots per window', async () => {
    const inspector = new DeterministicProviderQuotaInspector('codex', { now: () => refreshedAt });

    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'codex',
          status: 'valid',
          models: ['gpt-5', 'gpt-5-codex'],
          quota: { daily: { limit: 100, used: 50, resetAt: '2026-05-12T00:00:00.000Z' } }
        }
      ]
    });

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].model).toBe('gpt-5');
    expect(snapshots[1].model).toBe('gpt-5-codex');
  });

  it('defaults constructor options when none provided', () => {
    const inspector = new DeterministicProviderQuotaInspector('claude');
    expect(inspector.providerKind).toBe('claude');
  });

  it('uses 5h alias when fiveHour is defined in quota', async () => {
    const inspector = new DeterministicProviderQuotaInspector('codex', { now: () => refreshedAt });

    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'codex',
          status: 'active',
          models: ['gpt-5'],
          quota: { '5h': { limit: 100, used: 50, resetAt: '2026-05-11T05:00:00.000Z' } }
        }
      ]
    });

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].window).toBe('5h');
  });

  it('treats active status as valid', async () => {
    const inspector = new DeterministicProviderQuotaInspector('codex', { now: () => refreshedAt });

    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'codex',
          status: 'active',
          models: ['gpt-5'],
          quota: { daily: { limit: 100, used: 50, resetAt: '2026-05-12T00:00:00.000Z' } }
        }
      ]
    });

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].status).toBe('normal');
  });

  it('handles unknown snapshot with null accountEmail', async () => {
    const inspector = new DeterministicProviderQuotaInspector('codex', { now: () => refreshedAt });

    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'codex',
          status: 'error'
        }
      ]
    });

    expect(snapshots[0].accountEmail).toBeNull();
  });
});
