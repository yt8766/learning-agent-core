import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const counselorGovernanceMocks = vi.hoisted(() => ({
  appendGovernanceAuditMock: vi.fn(async () => undefined)
}));

vi.mock('../../../src/runtime/helpers/runtime-governance-store', () => ({
  appendGovernanceAudit: counselorGovernanceMocks.appendGovernanceAuditMock
}));

import {
  getCounselorSelectorConfigs,
  setCounselorSelectorEnabled,
  upsertCounselorSelectorConfig
} from '../../../src/runtime/centers/runtime-centers-governance-counselors';

describe('runtime-centers-governance-counselors', () => {
  beforeEach(() => {
    counselorGovernanceMocks.appendGovernanceAuditMock.mockClear();
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

    await expect(getCounselorSelectorConfigs(runtimeStateRepository as any)).resolves.toEqual([
      { selectorId: 'newer', updatedAt: '2026-04-02T10:00:00.000Z' },
      { selectorId: 'older', updatedAt: '2026-04-02T09:00:00.000Z' }
    ]);
  });

  it('returns an empty list when governance state is missing', async () => {
    const runtimeStateRepository = {
      load: vi.fn(async () => ({}))
    };

    await expect(getCounselorSelectorConfigs(runtimeStateRepository as any)).resolves.toEqual([]);
  });

  it('creates and updates counselor selector configs with governance audit records', async () => {
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
    expect(runtimeStateRepository.save).toHaveBeenCalledTimes(2);
    expect(counselorGovernanceMocks.appendGovernanceAuditMock).toHaveBeenNthCalledWith(
      1,
      runtimeStateRepository,
      expect.objectContaining({
        action: 'counselor-selector.created',
        targetId: 'sel-2',
        reason: 'round-robin:backend'
      })
    );
    expect(counselorGovernanceMocks.appendGovernanceAuditMock).toHaveBeenNthCalledWith(
      2,
      runtimeStateRepository,
      expect.objectContaining({
        action: 'counselor-selector.updated',
        targetId: 'sel-1',
        reason: 'weighted:frontend'
      })
    );
  });

  it('creates selector config when governance state is absent', async () => {
    const snapshot: Record<string, unknown> = {};
    const runtimeStateRepository = {
      load: vi.fn(async () => snapshot),
      save: vi.fn(async () => undefined)
    };

    await expect(
      upsertCounselorSelectorConfig(runtimeStateRepository as any, {
        selectorId: 'sel-bootstrap',
        domain: 'ops',
        strategy: 'weighted',
        candidateIds: ['ops-1'],
        defaultCounselorId: 'ops-1',
        enabled: false
      })
    ).resolves.toMatchObject({
      selectorId: 'sel-bootstrap',
      enabled: false,
      createdAt: '2026-04-02T10:45:00.000Z'
    });

    expect(snapshot).toMatchObject({
      governance: {
        counselorSelectorConfigs: [
          expect.objectContaining({
            selectorId: 'sel-bootstrap'
          })
        ]
      }
    });
  });

  it('toggles selector enablement and throws for missing selectors', async () => {
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
          },
          {
            selectorId: 'sel-2',
            domain: 'backend',
            enabled: false,
            strategy: 'round-robin',
            candidateIds: ['c2'],
            createdAt: '2026-04-01T11:00:00.000Z',
            updatedAt: '2026-04-01T11:00:00.000Z'
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
    expect(counselorGovernanceMocks.appendGovernanceAuditMock).toHaveBeenCalledWith(
      runtimeStateRepository,
      expect.objectContaining({
        action: 'counselor-selector.disabled',
        targetId: 'sel-1'
      })
    );
    expect(snapshot.governance.counselorSelectorConfigs[1]).toMatchObject({
      selectorId: 'sel-2',
      enabled: false
    });

    counselorGovernanceMocks.appendGovernanceAuditMock.mockClear();
    await expect(setCounselorSelectorEnabled(runtimeStateRepository as any, 'sel-1', true)).resolves.toMatchObject({
      selectorId: 'sel-1',
      enabled: true,
      updatedAt: '2026-04-02T10:45:00.000Z'
    });
    expect(counselorGovernanceMocks.appendGovernanceAuditMock).toHaveBeenCalledWith(
      runtimeStateRepository,
      expect.objectContaining({
        action: 'counselor-selector.enabled',
        targetId: 'sel-1'
      })
    );

    await expect(setCounselorSelectorEnabled(runtimeStateRepository as any, 'missing', true)).rejects.toThrow(
      new NotFoundException('Counselor selector missing not found')
    );
  });
});
