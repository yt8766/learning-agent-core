import { NotFoundException } from '@nestjs/common';

import type { SkillSourceRecord } from '@agent/core';
import type { RuntimeStateSnapshot } from '@agent/memory';
import { appendGovernanceAudit } from '@agent/runtime';

interface GovernanceStateRepository {
  load: () => Promise<RuntimeStateSnapshot>;
  save: (snapshot: RuntimeStateSnapshot) => Promise<void>;
}

interface CompanyWorkerRecord {
  id: string;
  kind?: string;
}

export async function setSkillSourceEnabledWithGovernance(input: {
  sourceId: string;
  enabled: boolean;
  actor?: string;
  runtimeStateRepository: GovernanceStateRepository;
  listSkillSources: () => Promise<SkillSourceRecord[]>;
}) {
  const sources = await input.listSkillSources();
  const source = sources.find(item => item.id === input.sourceId);
  if (!source) {
    throw new NotFoundException(`Skill source ${input.sourceId} not found`);
  }

  const snapshot = await input.runtimeStateRepository.load();
  const disabled = new Set(snapshot.governance?.disabledSkillSourceIds ?? []);
  if (input.enabled) {
    disabled.delete(input.sourceId);
  } else {
    disabled.add(input.sourceId);
  }
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    disabledSkillSourceIds: Array.from(disabled)
  };

  await input.runtimeStateRepository.save(snapshot);
  await appendGovernanceAudit(input.runtimeStateRepository, {
    actor: input.actor ?? 'agent-admin-user',
    action: input.enabled ? 'skill-source.enabled' : 'skill-source.disabled',
    scope: 'skill-source',
    targetId: input.sourceId,
    outcome: 'success'
  });

  return (await input.listSkillSources()).find(item => item.id === input.sourceId)!;
}

export async function syncSkillSourceWithGovernance(input: {
  sourceId: string;
  actor?: string;
  runtimeStateRepository: GovernanceStateRepository;
  listSkillSources: () => Promise<SkillSourceRecord[]>;
  skillSourceSyncService: {
    syncSource: (
      source: SkillSourceRecord
    ) => Promise<{ status: 'synced' | 'skipped' | 'failed'; manifestCount: number; error?: string }>;
  };
}) {
  const source = (await input.listSkillSources()).find(item => item.id === input.sourceId);
  if (!source) {
    throw new NotFoundException(`Skill source ${input.sourceId} not found`);
  }

  const result = await input.skillSourceSyncService.syncSource(source);
  await appendGovernanceAudit(input.runtimeStateRepository, {
    actor: input.actor ?? 'agent-admin-user',
    action: 'skill-source.synced',
    scope: 'skill-source',
    targetId: input.sourceId,
    outcome: result.status === 'failed' ? 'rejected' : 'success',
    reason: result.error ?? `manifestCount=${result.manifestCount}`
  });

  return (await input.listSkillSources()).find(item => item.id === input.sourceId)!;
}

export async function setCompanyWorkerEnabledWithGovernance<TCompanyWorkerView>(input: {
  workerId: string;
  enabled: boolean;
  actor?: string;
  runtimeStateRepository: GovernanceStateRepository;
  orchestrator: {
    listWorkers: () => CompanyWorkerRecord[];
    setWorkerEnabled: (workerId: string, enabled: boolean) => void;
  };
  loadCompanyWorkerView: (workerId: string) => Promise<TCompanyWorkerView> | TCompanyWorkerView;
}) {
  const worker = input
    .orchestrator
    .listWorkers()
    .find(item => item.id === input.workerId && item.kind === 'company');
  if (!worker) {
    throw new NotFoundException(`Company worker ${input.workerId} not found`);
  }

  const snapshot = await input.runtimeStateRepository.load();
  const disabled = new Set(snapshot.governance?.disabledCompanyWorkerIds ?? []);
  if (input.enabled) {
    disabled.delete(input.workerId);
  } else {
    disabled.add(input.workerId);
  }
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    disabledCompanyWorkerIds: Array.from(disabled)
  };

  await input.runtimeStateRepository.save(snapshot);
  input.orchestrator.setWorkerEnabled(input.workerId, input.enabled);
  await appendGovernanceAudit(input.runtimeStateRepository, {
    actor: input.actor ?? 'agent-admin-user',
    action: input.enabled ? 'company-worker.enabled' : 'company-worker.disabled',
    scope: 'company-worker',
    targetId: input.workerId,
    outcome: 'success'
  });

  return input.loadCompanyWorkerView(input.workerId);
}
