import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const counselorStoreMocks = vi.hoisted(() => ({
  listCounselorSelectorConfigsMock: vi.fn(async () => []),
  upsertCounselorSelectorConfigMock: vi.fn(async () => ({ selectorId: 'sel-1', enabled: true })),
  setCounselorSelectorEnabledMock: vi.fn(async () => ({ selectorId: 'sel-1', enabled: false }))
}));

vi.mock('@agent/runtime', async importOriginal => {
  const actual = await importOriginal<typeof import('@agent/runtime')>();
  return {
    ...actual,
    listCounselorSelectorConfigs: counselorStoreMocks.listCounselorSelectorConfigsMock,
    upsertCounselorSelectorConfig: counselorStoreMocks.upsertCounselorSelectorConfigMock,
    setCounselorSelectorEnabled: counselorStoreMocks.setCounselorSelectorEnabledMock
  };
});

import {
  getCounselorSelectorConfigs,
  setCounselorSelectorEnabled,
  upsertCounselorSelectorConfig
} from '../../../src/runtime/centers/runtime-centers-governance-counselors';

describe('runtime-centers-governance-counselors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates list and upsert to the runtime governance store host', async () => {
    const runtimeStateRepository = { load: vi.fn(), save: vi.fn() };

    counselorStoreMocks.listCounselorSelectorConfigsMock.mockResolvedValueOnce([{ selectorId: 'sel-2' }]);
    counselorStoreMocks.upsertCounselorSelectorConfigMock.mockResolvedValueOnce({ selectorId: 'sel-3', enabled: true });

    await expect(getCounselorSelectorConfigs(runtimeStateRepository as any)).resolves.toEqual([
      { selectorId: 'sel-2' }
    ]);
    await expect(
      upsertCounselorSelectorConfig(
        runtimeStateRepository as any,
        {
          selectorId: 'sel-3'
        } as any
      )
    ).resolves.toEqual({ selectorId: 'sel-3', enabled: true });

    expect(counselorStoreMocks.listCounselorSelectorConfigsMock).toHaveBeenCalledWith(runtimeStateRepository);
    expect(counselorStoreMocks.upsertCounselorSelectorConfigMock).toHaveBeenCalledWith(runtimeStateRepository, {
      selectorId: 'sel-3'
    });
  });

  it('maps missing selector updates to NotFoundException', async () => {
    const runtimeStateRepository = { load: vi.fn(), save: vi.fn() };

    counselorStoreMocks.setCounselorSelectorEnabledMock.mockResolvedValueOnce(undefined);
    await expect(setCounselorSelectorEnabled(runtimeStateRepository as any, 'missing', true)).rejects.toThrow(
      new NotFoundException('Counselor selector missing not found')
    );

    counselorStoreMocks.setCounselorSelectorEnabledMock.mockResolvedValueOnce({ selectorId: 'sel-1', enabled: false });
    await expect(setCounselorSelectorEnabled(runtimeStateRepository as any, 'sel-1', false)).resolves.toEqual({
      selectorId: 'sel-1',
      enabled: false
    });
  });
});
