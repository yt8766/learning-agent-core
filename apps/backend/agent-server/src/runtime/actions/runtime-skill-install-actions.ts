import { NotFoundException } from '@nestjs/common';

import {
  InstallRemoteSkillDto,
  InstallSkillDto,
  ResolveSkillInstallDto,
  SkillInstallReceipt,
  SkillManifestRecord,
  SkillSourceRecord
} from '@agent/shared';

import { appendGovernanceAudit } from '../helpers/runtime-governance-store';
import { buildSkillsAddCommand, normalizeRepoForInstall } from '../skills/runtime-skill-cli';

export async function installSkillWithGovernance(input: {
  dto: InstallSkillDto;
  runtimeStateRepository: { load: () => Promise<any>; save: (snapshot: any) => Promise<void> };
  listSkillSources: () => Promise<SkillSourceRecord[]>;
  listSkillManifests: () => Promise<SkillManifestRecord[]>;
  evaluateSkillManifestSafety: (
    manifest: SkillManifestRecord,
    source: SkillSourceRecord
  ) => { verdict: 'allow' | 'needs-approval' | 'blocked' };
  writeSkillInstallReceipt: (receipt: SkillInstallReceipt) => Promise<void>;
  finalizeSkillInstall: (
    manifest: SkillManifestRecord,
    source: SkillSourceRecord,
    receipt: SkillInstallReceipt
  ) => Promise<void>;
}) {
  const [sources, manifests] = await Promise.all([input.listSkillSources(), input.listSkillManifests()]);
  const manifest = manifests.find(item => item.id === input.dto.manifestId);
  if (!manifest) {
    throw new NotFoundException(`Skill manifest ${input.dto.manifestId} not found`);
  }
  const source = sources.find(item => item.id === (input.dto.sourceId ?? manifest.sourceId));
  if (!source) {
    throw new NotFoundException(`Skill source ${input.dto.sourceId ?? manifest.sourceId} not found`);
  }
  if (!source.enabled) {
    throw new NotFoundException(`Skill source ${source.id} is disabled`);
  }

  const safety = input.evaluateSkillManifestSafety(manifest, source);
  const requiresApproval =
    safety.verdict === 'needs-approval' || source.trustClass === 'community' || source.trustClass === 'unverified';

  if (safety.verdict === 'blocked') {
    throw new NotFoundException(`Skill manifest ${input.dto.manifestId} is blocked by local safety evaluation`);
  }

  const receipt: SkillInstallReceipt = {
    id: `receipt_${manifest.id}_${Date.now()}`,
    skillId: manifest.id,
    version: manifest.version,
    sourceId: source.id,
    phase: requiresApproval ? 'requested' : 'approved',
    integrity: manifest.integrity,
    approvedBy: requiresApproval ? undefined : (input.dto.actor ?? 'system'),
    installedAt: requiresApproval ? undefined : new Date().toISOString(),
    status: requiresApproval ? 'pending' : 'installed',
    result: requiresApproval ? 'waiting_for_install_approval' : 'installed_to_lab'
  };

  await input.writeSkillInstallReceipt(receipt);
  await appendGovernanceAudit(input.runtimeStateRepository, {
    actor: input.dto.actor ?? 'system',
    action: 'skill.install.requested',
    scope: 'skill-install',
    targetId: manifest.id,
    outcome: requiresApproval ? 'pending' : 'success',
    reason: requiresApproval ? 'waiting_for_install_approval' : 'installed_to_lab'
  });
  if (!requiresApproval) {
    await input.finalizeSkillInstall(manifest, source, receipt);
  }
  return receipt;
}

export async function approveSkillInstallWithGovernance(input: {
  receiptId: string;
  dto: ResolveSkillInstallDto;
  runtimeStateRepository: { load: () => Promise<any>; save: (snapshot: any) => Promise<void> };
  getSkillInstallReceipt: (receiptId: string) => Promise<SkillInstallReceipt>;
  listSkillSources: () => Promise<SkillSourceRecord[]>;
  listSkillManifests: () => Promise<SkillManifestRecord[]>;
  writeSkillInstallReceipt: (receipt: SkillInstallReceipt) => Promise<void>;
  finalizeSkillInstall: (
    manifest: SkillManifestRecord,
    source: SkillSourceRecord,
    receipt: SkillInstallReceipt
  ) => Promise<void>;
  finalizeRemoteSkillInstall: (receipt: SkillInstallReceipt) => Promise<void>;
}) {
  const receipt = await input.getSkillInstallReceipt(input.receiptId);
  if (receipt.status === 'installed') {
    return receipt;
  }
  const [sources, manifests] = await Promise.all([input.listSkillSources(), input.listSkillManifests()]);
  const manifest = manifests.find(item => item.id === receipt.skillId);
  const source = sources.find(item => item.id === receipt.sourceId);
  if (!source) {
    throw new NotFoundException(`Install dependencies for receipt ${input.receiptId} not found`);
  }
  if (!receipt.repo && !manifest) {
    throw new NotFoundException(`Install dependencies for receipt ${input.receiptId} not found`);
  }

  receipt.status = 'approved';
  receipt.approvedBy = input.dto.actor ?? 'agent-admin-user';
  receipt.phase = 'approved';
  receipt.result = 'approved_pending_install';
  await input.writeSkillInstallReceipt(receipt);

  let installOutcome: 'success' | 'rejected' = 'success';
  try {
    if (receipt.repo) {
      await input.finalizeRemoteSkillInstall(receipt);
    } else {
      await input.finalizeSkillInstall(manifest!, source, receipt);
    }
  } catch {
    installOutcome = 'rejected';
  }

  await appendGovernanceAudit(input.runtimeStateRepository, {
    actor: input.dto.actor ?? 'agent-admin-user',
    action: 'skill.install.approved',
    scope: 'skill-install',
    targetId: receipt.skillId,
    outcome: installOutcome,
    reason: input.receiptId
  });
  return input.getSkillInstallReceipt(input.receiptId);
}

export async function installRemoteSkillWithGovernance(input: {
  dto: InstallRemoteSkillDto;
  runtimeStateRepository: { load: () => Promise<any>; save: (snapshot: any) => Promise<void> };
  listSkillSources: () => Promise<SkillSourceRecord[]>;
  writeSkillInstallReceipt: (receipt: SkillInstallReceipt) => Promise<void>;
  finalizeRemoteSkillInstall: (receipt: SkillInstallReceipt) => Promise<void>;
}) {
  const source = (await input.listSkillSources()).find(item => item.id === 'skills-sh-directory');
  if (!source) {
    throw new NotFoundException('Skill source skills-sh-directory not found');
  }
  if (!source.enabled) {
    throw new NotFoundException('Skill source skills-sh-directory is disabled');
  }

  const explicitSkillName = input.dto.skillName?.trim();
  const skillId = explicitSkillName
    ? `remote-${sanitizeId(input.dto.repo)}-${sanitizeId(explicitSkillName)}`
    : `remote-${sanitizeId(input.dto.repo)}`;
  const installCommand =
    input.dto.installCommand ??
    buildSkillsAddCommand({ repo: normalizeRepoForInstall(input.dto.repo), skillName: explicitSkillName });
  const requiresApproval = input.dto.actor !== 'agent-chat-user' && source.trustClass !== 'internal';
  const receipt: SkillInstallReceipt = {
    id: `receipt_${skillId}_${Date.now()}`,
    skillId,
    version: 'remote',
    sourceId: source.id,
    phase: requiresApproval ? 'requested' : 'approved',
    status: requiresApproval ? 'pending' : 'approved',
    result: requiresApproval ? 'waiting_for_install_approval' : 'approved_pending_install',
    approvedBy: requiresApproval ? undefined : (input.dto.actor ?? 'system'),
    reason: input.dto.summary,
    repo: input.dto.repo,
    skillName: explicitSkillName,
    detailsUrl: input.dto.detailsUrl,
    installCommand,
    triggerReason: input.dto.triggerReason
  };

  await input.writeSkillInstallReceipt(receipt);
  let auditOutcome: 'success' | 'pending' | 'rejected' = requiresApproval ? 'pending' : 'success';
  await appendGovernanceAudit(input.runtimeStateRepository, {
    actor: input.dto.actor ?? 'system',
    action: 'skill.remote-install.requested',
    scope: 'skill-install',
    targetId: skillId,
    outcome: auditOutcome,
    reason: installCommand
  });
  if (!requiresApproval) {
    try {
      await input.finalizeRemoteSkillInstall(receipt);
    } catch {
      auditOutcome = 'rejected';
      await appendGovernanceAudit(input.runtimeStateRepository, {
        actor: input.dto.actor ?? 'system',
        action: 'skill.remote-install.started',
        scope: 'skill-install',
        targetId: skillId,
        outcome: auditOutcome,
        reason: receipt.failureCode ?? receipt.result
      });
      return receipt;
    }
  }
  return receipt;
}

export async function rejectSkillInstallWithGovernance(input: {
  receiptId: string;
  dto: ResolveSkillInstallDto;
  runtimeStateRepository: { load: () => Promise<any>; save: (snapshot: any) => Promise<void> };
  getSkillInstallReceipt: (receiptId: string) => Promise<SkillInstallReceipt>;
  writeSkillInstallReceipt: (receipt: SkillInstallReceipt) => Promise<void>;
}) {
  const receipt = await input.getSkillInstallReceipt(input.receiptId);
  receipt.status = 'rejected';
  receipt.phase = 'failed';
  receipt.rejectedBy = input.dto.actor ?? 'agent-admin-user';
  receipt.reason = input.dto.reason;
  receipt.result = input.dto.reason ?? 'install_rejected';
  await input.writeSkillInstallReceipt(receipt);
  await appendGovernanceAudit(input.runtimeStateRepository, {
    actor: input.dto.actor ?? 'agent-admin-user',
    action: 'skill.install.rejected',
    scope: 'skill-install',
    targetId: receipt.skillId,
    outcome: 'rejected',
    reason: input.dto.reason
  });
  return receipt;
}

function sanitizeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function deriveSkillNameFromRepo(repo: string) {
  const normalized = repo.replace(/\/+$/, '');
  const segments = normalized.split('/');
  return segments[segments.length - 1] || 'remote-skill';
}
