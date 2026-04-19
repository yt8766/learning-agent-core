import { NotFoundException } from '@nestjs/common';
import {
  listCounselorSelectorConfigs as loadCounselorSelectorConfigs,
  setCounselorSelectorEnabled as persistCounselorSelectorEnabled,
  upsertCounselorSelectorConfig as persistCounselorSelectorConfig
} from '@agent/runtime';

export const getCounselorSelectorConfigs = loadCounselorSelectorConfigs;
export const upsertCounselorSelectorConfig = persistCounselorSelectorConfig;

export async function setCounselorSelectorEnabled(
  runtimeStateRepository: Parameters<typeof persistCounselorSelectorEnabled>[0],
  selectorId: string,
  enabled: boolean
) {
  const updated = await persistCounselorSelectorEnabled(runtimeStateRepository, selectorId, enabled);
  if (!updated) {
    throw new NotFoundException(`Counselor selector ${selectorId} not found`);
  }
  return updated;
}
