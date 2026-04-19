import { beforeEach, describe, expect, it, vi } from 'vitest';

const governanceMocks = vi.hoisted(() => ({
  appendGovernanceAuditMock: vi.fn(async () => undefined)
}));

vi.mock('../src/governance/runtime-governance-store', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/governance/runtime-governance-store')>();
  return {
    ...actual,
    appendGovernanceAudit: governanceMocks.appendGovernanceAuditMock
  };
});

import {
  listCounselorSelectorConfigs,
  setCounselorSelectorEnabled,
  upsertCounselorSelectorConfig
} from '../src/governance/runtime-counselor-selector-store';

describe('runtime-counselor-selector-store', () => {
  beforeEach(() => {
    governanceMocks.appendGovernanceAuditMock.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-02T10:45:00.000Z'));
  });

  it('sorts counselor selector configs by updated time descending', async () => {
    const runtimeStateRepository = {
      load: vi.fn(async () => ({
        governance: {
          counselorSelectorConfigs: [
            { selectorId: 'older', updatedAt: '2026-04-02T09:00:00.000Z' },
            { selectorId: 'newer', updatedAt: '2026-04-02T10:00:00.000Z' }
          ]
        }
      }))
    };

    await expect(listCounselorSelectorConfigs(runtimeStateRepository as any)).resolves.toEqual([
      { selectorId: 'newer', updatedAt: '2026-04-02T10:00:00.000Z' },
      { selectorId: 'older', updatedAt: '2026-04-02T09:00:00.000Z' }
    ]);
  });

  it('creates and updates selector configs with governance audit records', async () => {
    const snapshot = {
      governance: {
        counselorSelectorConfigs: [
          {
            selectorId: 'sel-1',
            domain: 'frontend',
            enabled: false,
            strategy: 'weighted',
            candidateIds: ['old'],
            createdAt: '2026-04-01T10:00:00.000Z',
            updatedAt: '2026-04-01T10:00:00.000Z'
          }
        ]
      }
    };
    const runtimeStateRepository = {
      load: vi.fn(async () => snapshot),
      save: vi.fn(async () => undefined)
    };

    const created = await upsertCounselorSelectorConfig(runtimeStateRepository as any, {
      selectorId: 'sel-2',
      domain: 'backend',
      strategy: 'round-robin',
      candidateIds: ['c1'],
      defaultCounselorId: 'c1'
    });
    const updated = await upsertCounselorSelectorConfig(runtimeStateRepository as any, {
      selectorId: 'sel-1',
      domain: 'frontend',
      enabled: true,
      strategy: 'weighted',
      candidateIds: ['c2'],
      defaultCounselorId: 'c2'
    });

    expect(created).toMatchObject({
      selectorId: 'sel-2',
      domain: 'backend',
      enabled: true,
      createdAt: '2026-04-02T10:45:00.000Z',
      updatedAt: '2026-04-02T10:45:00.000Z'
    });
    expect(updated).toMatchObject({
      selectorId: 'sel-1',
      enabled: true,
      candidateIds: ['c2'],
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-02T10:45:00.000Z'
    });
    expect(governanceMocks.appendGovernanceAuditMock).toHaveBeenNthCalledWith(
      1,
      runtimeStateRepository,
      expect.objectContaining({
        action: 'counselor-selector.created',
        targetId: 'sel-2',
        reason: 'round-robin:backend'
      })
    );
    expect(governanceMocks.appendGovernanceAuditMock).toHaveBeenNthCalledWith(
      2,
      runtimeStateRepository,
      expect.objectContaining({
        action: 'counselor-selector.updated',
        targetId: 'sel-1',
        reason: 'weighted:frontend'
      })
    );
  });

  it('toggles selector enablement and returns undefined for missing selectors', async () => {
    const snapshot = {
      governance: {
        counselorSelectorConfigs: [
          {
            selectorId: 'sel-1',
            domain: 'frontend',
            enabled: true,
            strategy: 'weighted',
            candidateIds: ['c1'],
            createdAt: '2026-04-01T10:00:00.000Z',
            updatedAt: '2026-04-01T10:00:00.000Z'
          }
        ]
      }
    };
    const runtimeStateRepository = {
      load: vi.fn(async () => snapshot),
      save: vi.fn(async () => undefined)
    };

    await expect(setCounselorSelectorEnabled(runtimeStateRepository as any, 'sel-1', false)).resolves.toMatchObject({
      selectorId: 'sel-1',
      enabled: false,
      updatedAt: '2026-04-02T10:45:00.000Z'
    });
    expect(governanceMocks.appendGovernanceAuditMock).toHaveBeenCalledWith(
      runtimeStateRepository,
      expect.objectContaining({
        action: 'counselor-selector.disabled',
        targetId: 'sel-1'
      })
    );

    await expect(setCounselorSelectorEnabled(runtimeStateRepository as any, 'missing', true)).resolves.toBeUndefined();
  });
});
