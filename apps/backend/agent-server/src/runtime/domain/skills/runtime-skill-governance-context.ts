import type {
  InstallRemoteSkillDto,
  InstallSkillDto,
  ResolveSkillInstallDto,
  SkillManifestRecord,
  SkillSourceRecord
} from '@agent/core';

import type { RuntimeCentersContext } from '../../centers/runtime-centers.types';
import {
  completeRemoteSkillInstall,
  completeSkillInstall,
  persistSkillInstallReceipt
} from './runtime-skill-orchestration';
import { evaluateSkillManifestSafety } from '../../skills/runtime-skill-safety';
import { getSkillInstallReceipt, type RuntimeSkillInstallContext } from '../../skills/runtime-skill-install.service';
import { listSkillManifests, listSkillSources } from '../../skills/runtime-skill-sources.service';

function getSharedSkillGovernanceContext(ctx: RuntimeCentersContext) {
  return {
    runtimeStateRepository: ctx.runtimeStateRepository,
    listSkillSources: () => listSkillSources(ctx.getSkillSourcesContext()),
    listSkillManifests: () => listSkillManifests(ctx.getSkillSourcesContext()),
    writeSkillInstallReceipt: (receipt: Parameters<typeof persistSkillInstallReceipt>[0]['receipt']) =>
      persistSkillInstallReceipt({
        getSkillInstallContext: () => ctx.getSkillInstallContext() as RuntimeSkillInstallContext,
        receipt
      }),
    finalizeSkillInstall: (
      manifest: SkillManifestRecord,
      source: SkillSourceRecord,
      receipt: Parameters<typeof completeSkillInstall>[0]['receipt']
    ) =>
      completeSkillInstall({
        getSkillInstallContext: () => ctx.getSkillInstallContext() as RuntimeSkillInstallContext,
        manifest,
        source,
        receipt
      }),
    finalizeRemoteSkillInstall: (receipt: Parameters<typeof completeRemoteSkillInstall>[0]['receipt']) =>
      completeRemoteSkillInstall({
        getSkillInstallContext: () => ctx.getSkillInstallContext() as RuntimeSkillInstallContext,
        receipt
      }),
    getSkillInstallReceipt: (receiptId: string) => getSkillInstallReceipt(ctx.getSkillInstallContext(), receiptId)
  };
}

export function createInstallSkillGovernanceContext(ctx: RuntimeCentersContext, dto: InstallSkillDto) {
  const shared = getSharedSkillGovernanceContext(ctx);
  return {
    dto,
    runtimeStateRepository: shared.runtimeStateRepository,
    listSkillSources: shared.listSkillSources,
    listSkillManifests: shared.listSkillManifests,
    evaluateSkillManifestSafety: (manifest: SkillManifestRecord, source: SkillSourceRecord | undefined) =>
      evaluateSkillManifestSafety(ctx.getSkillSourcesContext(), manifest, source),
    writeSkillInstallReceipt: shared.writeSkillInstallReceipt,
    finalizeSkillInstall: shared.finalizeSkillInstall
  };
}

export function createInstallRemoteSkillGovernanceContext(ctx: RuntimeCentersContext, dto: InstallRemoteSkillDto) {
  const shared = getSharedSkillGovernanceContext(ctx);
  return {
    dto,
    runtimeStateRepository: shared.runtimeStateRepository,
    listSkillSources: shared.listSkillSources,
    writeSkillInstallReceipt: shared.writeSkillInstallReceipt,
    finalizeRemoteSkillInstall: shared.finalizeRemoteSkillInstall
  };
}

export function createApproveSkillInstallGovernanceContext(
  ctx: RuntimeCentersContext,
  receiptId: string,
  dto: ResolveSkillInstallDto
) {
  const shared = getSharedSkillGovernanceContext(ctx);
  return {
    receiptId,
    dto,
    runtimeStateRepository: shared.runtimeStateRepository,
    getSkillInstallReceipt: shared.getSkillInstallReceipt,
    listSkillSources: shared.listSkillSources,
    listSkillManifests: shared.listSkillManifests,
    writeSkillInstallReceipt: shared.writeSkillInstallReceipt,
    finalizeSkillInstall: shared.finalizeSkillInstall,
    finalizeRemoteSkillInstall: shared.finalizeRemoteSkillInstall
  };
}

export function createRejectSkillInstallGovernanceContext(
  ctx: RuntimeCentersContext,
  receiptId: string,
  dto: ResolveSkillInstallDto
) {
  const shared = getSharedSkillGovernanceContext(ctx);
  return {
    receiptId,
    dto,
    runtimeStateRepository: shared.runtimeStateRepository,
    getSkillInstallReceipt: shared.getSkillInstallReceipt,
    writeSkillInstallReceipt: shared.writeSkillInstallReceipt
  };
}
