import { NotFoundException } from '@nestjs/common';

import type { CounselorSelectorConfig } from '@agent/core';

import { appendGovernanceAudit } from '../../modules/runtime-governance/services/runtime-governance-store';

export async function getCounselorSelectorConfigs(runtimeStateRepository: { load: () => Promise<any> }) {
  const snapshot = await runtimeStateRepository.load();
  return (snapshot.governance?.counselorSelectorConfigs ?? [])
    .slice()
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

export async function upsertCounselorSelectorConfig(
  runtimeStateRepository: { load: () => Promise<any>; save: (snapshot: any) => Promise<void> },
  input: Pick<CounselorSelectorConfig, 'selectorId' | 'domain' | 'strategy' | 'candidateIds' | 'defaultCounselorId'> &
    Partial<Pick<CounselorSelectorConfig, 'enabled' | 'weights' | 'featureFlag'>>
) {
  const now = new Date().toISOString();
  const snapshot = await runtimeStateRepository.load();
  const current = snapshot.governance?.counselorSelectorConfigs ?? [];
  const existing = current.find((item: CounselorSelectorConfig) => item.selectorId === input.selectorId);
  const next: CounselorSelectorConfig = {
    selectorId: input.selectorId,
    domain: input.domain,
    enabled: input.enabled ?? true,
    strategy: input.strategy,
    candidateIds: input.candidateIds,
    weights: input.weights,
    featureFlag: input.featureFlag,
    defaultCounselorId: input.defaultCounselorId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    counselorSelectorConfigs: [
      ...current.filter((item: CounselorSelectorConfig) => item.selectorId !== input.selectorId),
      next
    ]
  };
  await runtimeStateRepository.save(snapshot);
  await appendGovernanceAudit(runtimeStateRepository, {
    actor: 'agent-admin-user',
    action: existing ? 'counselor-selector.updated' : 'counselor-selector.created',
    scope: 'counselor-selector',
    targetId: input.selectorId,
    outcome: 'success',
    reason: `${input.strategy}:${input.domain}`
  });
  return next;
}

export async function setCounselorSelectorEnabled(
  runtimeStateRepository: { load: () => Promise<any>; save: (snapshot: any) => Promise<void> },
  selectorId: string,
  enabled: boolean
) {
  const snapshot = await runtimeStateRepository.load();
  const current = snapshot.governance?.counselorSelectorConfigs ?? [];
  const selector = current.find((item: CounselorSelectorConfig) => item.selectorId === selectorId);
  if (!selector) {
    throw new NotFoundException(`Counselor selector ${selectorId} not found`);
  }
  const updated = {
    ...selector,
    enabled,
    updatedAt: new Date().toISOString()
  };
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    counselorSelectorConfigs: current.map((item: CounselorSelectorConfig) =>
      item.selectorId === selectorId ? updated : item
    )
  };
  await runtimeStateRepository.save(snapshot);
  await appendGovernanceAudit(runtimeStateRepository, {
    actor: 'agent-admin-user',
    action: enabled ? 'counselor-selector.enabled' : 'counselor-selector.disabled',
    scope: 'counselor-selector',
    targetId: selectorId,
    outcome: 'success'
  });
  return updated;
}
