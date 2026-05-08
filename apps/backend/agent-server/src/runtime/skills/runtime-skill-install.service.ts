import { dirname, join } from 'node:path';
import { ensureDir, writeFile } from 'fs-extra';

import { NotFoundException } from '@nestjs/common';

import type {
  InstalledSkillRecord,
  SkillCard,
  SkillInstallReceipt,
  SkillManifestRecord,
  SkillSourceRecord
} from '@agent/core';
import {
  buildRemoteSkillInstallLocation,
  deriveRemoteSkillDisplayName,
  normalizeOptionalSkillName,
  type SkillInstallRepository
} from '@agent/skill';

import {
  buildSkillsAddCommand,
  buildSkillsAddCommandPlan,
  buildSkillsCheckCommandPlan,
  buildSkillsUpdateCommandPlan,
  execSkillsCommand
} from './runtime-skill-cli';

export interface RuntimeSkillInstallContext {
  settings: {
    workspaceRoot: string;
    skillReceiptsRoot: string;
    skillPackagesRoot: string;
  };
  skillRegistry: {
    publishToLab: (skill: SkillCard) => Promise<SkillCard>;
  };
  skillArtifactFetcher: {
    fetchToStaging: (
      manifest: SkillManifestRecord,
      source: SkillSourceRecord,
      receiptId: string
    ) => Promise<{ artifactPath?: string; stagingDir: string; integrityVerified: boolean }>;
    promoteFromStaging: (stagingDir: string, installLocation: string) => Promise<void>;
    removeStaging?: (stagingDir: string) => Promise<void>;
    removeStagingByReceiptId?: (receiptId: string) => Promise<void>;
  };
  listSkillSources: () => Promise<SkillSourceRecord[]>;
  registerInstalledSkillWorker: (skill: SkillCard) => void;
  remoteSkillCli?: {
    install: (params: { repo: string; skillName?: string }) => Promise<{ stdout: string; stderr: string }>;
    check: () => Promise<{ stdout: string; stderr: string }>;
    update: () => Promise<{ stdout: string; stderr: string }>;
  };
  skillInstallRepository?: SkillInstallRepository;
}

export async function autoInstallLocalManifest(context: RuntimeSkillInstallContext, manifest: SkillManifestRecord) {
  const sources = await context.listSkillSources();
  const source = sources.find(item => item.id === manifest.sourceId);
  if (!source || !source.enabled) {
    return undefined;
  }

  const receipt: SkillInstallReceipt = {
    id: `receipt_auto_${Date.now()}`,
    skillId: manifest.id,
    version: manifest.version,
    sourceId: source.id,
    sourceDraftId: extractWorkspaceDraftId(manifest),
    approvedBy: 'runtime-auto',
    phase: 'approved',
    status: 'approved',
    result: 'auto_install_low_risk'
  };

  await writeSkillInstallReceipt(context, receipt);
  return finalizeSkillInstall(context, manifest, source, receipt);
}

function extractWorkspaceDraftId(manifest: SkillManifestRecord): string | undefined {
  if (manifest.sourceId !== 'workspace-skill-drafts') {
    return undefined;
  }

  const metadataDraftId = manifest.metadata?.draftId;
  if (typeof metadataDraftId === 'string' && metadataDraftId.trim()) {
    return metadataDraftId;
  }

  if (manifest.entry?.startsWith('workspace-draft:')) {
    return manifest.entry.slice('workspace-draft:'.length);
  }

  return undefined;
}

export async function getSkillInstallReceipt(context: RuntimeSkillInstallContext, receiptId: string) {
  const receipts = await readSkillInstallReceipts(context);
  const receipt = receipts.find(item => item.id === receiptId);
  if (!receipt) {
    throw new NotFoundException(`Skill install receipt ${receiptId} not found`);
  }
  return receipt;
}

export async function readSkillInstallReceipts(context: RuntimeSkillInstallContext): Promise<SkillInstallReceipt[]> {
  return requireSkillInstallRepository(context).listReceipts();
}

export async function writeSkillInstallReceipt(
  context: RuntimeSkillInstallContext,
  receipt: SkillInstallReceipt
): Promise<void> {
  await requireSkillInstallRepository(context).saveReceipt(receipt);
}

export async function readInstalledSkillRecords(context: RuntimeSkillInstallContext): Promise<InstalledSkillRecord[]> {
  return requireSkillInstallRepository(context).listInstalledRecords();
}

export async function writeInstalledSkillRecord(
  context: RuntimeSkillInstallContext,
  record: InstalledSkillRecord
): Promise<void> {
  await requireSkillInstallRepository(context).saveInstalledRecord(record);
}

export async function finalizeSkillInstall(
  context: RuntimeSkillInstallContext,
  manifest: SkillManifestRecord,
  source: SkillSourceRecord,
  receipt: SkillInstallReceipt
): Promise<InstalledSkillRecord> {
  let stagedArtifact: { stagingDir: string } | undefined;
  try {
    const installedAt = new Date().toISOString();
    const installBaseLocation = join(
      context.settings.skillPackagesRoot,
      source.kind === 'internal' ? 'internal' : source.kind === 'marketplace' ? 'marketplace' : 'third-party'
    );
    const installLocation = join(installBaseLocation, manifest.id, manifest.version);
    const installed: InstalledSkillRecord = {
      skillId: manifest.id,
      version: manifest.version,
      sourceId: source.id,
      installLocation,
      installedAt,
      status: 'installed',
      receiptId: receipt.id
    };

    const skillCard: SkillCard = {
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
      applicableGoals: [manifest.summary ?? manifest.description],
      requiredTools: manifest.allowedTools ?? manifest.requiredCapabilities,
      steps: [
        {
          title: 'Load installed skill manifest',
          instruction: manifest.summary ?? manifest.description,
          toolNames: manifest.allowedTools ?? manifest.requiredCapabilities
        }
      ],
      constraints: [
        `source=${source.id}`,
        `approvalPolicy=${manifest.approvalPolicy}`,
        ...(manifest.compatibility ? [`compatibility=${manifest.compatibility}`] : []),
        ...(manifest.requiredConnectors ?? []).map(connector => `connector=${connector}`)
      ],
      successSignals: ['skill_installed', 'lab_ready'],
      riskLevel: manifest.riskLevel,
      source: 'research',
      status: 'lab',
      version: manifest.version,
      governanceRecommendation: 'keep-lab',
      sourceId: source.id,
      installReceiptId: receipt.id,
      requiredCapabilities: manifest.requiredCapabilities,
      requiredConnectors: manifest.requiredConnectors,
      allowedTools: manifest.allowedTools,
      compatibility: manifest.compatibility,
      createdAt: installedAt,
      updatedAt: installedAt
    };

    receipt.phase = 'downloading';
    receipt.result = 'downloading_artifact';
    await writeSkillInstallReceipt(context, receipt);
    const artifact = await context.skillArtifactFetcher.fetchToStaging(manifest, source, receipt.id);
    stagedArtifact = artifact;

    receipt.phase = 'verifying';
    receipt.downloadRef = artifact.artifactPath;
    receipt.result = artifact.integrityVerified ? 'artifact_verified' : 'artifact_staged';
    await writeSkillInstallReceipt(context, receipt);

    receipt.phase = 'installing';
    receipt.result = 'registering_skill';
    await writeSkillInstallReceipt(context, receipt);
    await context.skillArtifactFetcher.promoteFromStaging(artifact.stagingDir, installLocation);

    receipt.status = 'installed';
    receipt.phase = 'installed';
    receipt.installedAt = installedAt;
    receipt.result = 'installed_to_lab';
    await writeSkillInstallReceipt(context, receipt);
    await writeInstalledSkillRecord(context, installed);
    await writeJsonFile(join(installLocation, `${manifest.id}@${manifest.version}.json`), {
      manifest,
      source,
      receipt,
      artifact
    });
    const published = await context.skillRegistry.publishToLab(skillCard);
    context.registerInstalledSkillWorker(published);
    return installed;
  } catch (error) {
    receipt.status = 'failed';
    receipt.phase = 'failed';
    receipt.failureCode = error instanceof Error ? error.message : 'skill_install_failed';
    receipt.failureDetail = error instanceof Error ? error.stack : String(error);
    receipt.result = 'install_failed';
    await writeSkillInstallReceipt(context, receipt);
    if (stagedArtifact) {
      await context.skillArtifactFetcher.removeStaging?.(stagedArtifact.stagingDir);
    } else {
      await context.skillArtifactFetcher.removeStagingByReceiptId?.(receipt.id);
    }
    throw error;
  }
}

export async function finalizeRemoteSkillInstall(
  context: RuntimeSkillInstallContext,
  receipt: SkillInstallReceipt
): Promise<InstalledSkillRecord> {
  if (!receipt.repo) {
    throw new Error(`Remote skill receipt ${receipt.id} is missing repo`);
  }

  const cliSkillName = normalizeOptionalSkillName(receipt.skillName);
  const resolvedSkillName = cliSkillName ?? deriveRemoteSkillDisplayName(receipt.repo);
  const version = receipt.version || 'remote';
  const installCommand =
    receipt.installCommand ?? buildSkillsAddCommand({ repo: receipt.repo, skillName: cliSkillName });
  const runner = context.remoteSkillCli?.install ?? defaultRemoteSkillInstall;
  try {
    receipt.phase = 'installing';
    receipt.result = 'running_npx_skills_add';
    await writeSkillInstallReceipt(context, receipt);

    const cliResult = await runner({ repo: receipt.repo, skillName: cliSkillName });
    const installedAt = new Date().toISOString();
    const installLocation = buildRemoteSkillInstallLocation({
      skillPackagesRoot: context.settings.skillPackagesRoot,
      repo: receipt.repo,
      resolvedSkillName,
      version
    });
    const installed: InstalledSkillRecord = {
      skillId: receipt.skillId,
      version,
      sourceId: receipt.sourceId,
      installLocation,
      installedAt,
      status: 'installed',
      receiptId: receipt.id
    };

    const skillCard: SkillCard = {
      id: receipt.skillId,
      name: resolvedSkillName,
      description: receipt.reason ?? `Imported from ${receipt.repo} via npx skills add`,
      applicableGoals: [receipt.reason ?? `Use ${resolvedSkillName} for specialized execution and answer quality.`],
      requiredTools: [],
      steps: [
        {
          title: 'Load remote-installed skill',
          instruction: `Use ${resolvedSkillName} from ${receipt.repo} when the session needs more specialized help.`,
          toolNames: []
        }
      ],
      constraints: [`source=${receipt.sourceId}`, `repo=${receipt.repo}`, `installCommand=${installCommand}`],
      successSignals: ['skill_installed', 'lab_ready'],
      riskLevel: 'low',
      source: 'research',
      status: 'lab',
      version,
      governanceRecommendation: 'keep-lab',
      sourceId: receipt.sourceId,
      installReceiptId: receipt.id,
      createdAt: installedAt,
      updatedAt: installedAt
    };

    await ensureDir(installLocation);
    await writeJsonFile(join(installLocation, `${receipt.skillId}.json`), {
      receipt,
      installCommand,
      cliResult
    });
    const published = await context.skillRegistry.publishToLab(skillCard);
    context.registerInstalledSkillWorker(published);
    await writeInstalledSkillRecord(context, installed);

    receipt.status = 'installed';
    receipt.phase = 'installed';
    receipt.installedAt = installedAt;
    receipt.result = 'installed_to_lab';
    receipt.downloadRef = installLocation;
    await writeSkillInstallReceipt(context, receipt);
    return installed;
  } catch (error) {
    receipt.status = 'failed';
    receipt.phase = 'failed';
    receipt.failureCode = error instanceof Error ? error.message : 'remote_skill_install_failed';
    receipt.failureDetail = error instanceof Error ? error.stack : String(error);
    receipt.result = 'install_failed';
    await writeSkillInstallReceipt(context, receipt);
    throw error;
  }
}

export async function checkInstalledSkills(context: RuntimeSkillInstallContext) {
  const runner = context.remoteSkillCli?.check ?? defaultRemoteSkillCheck;
  return runner();
}

export async function updateInstalledSkills(context: RuntimeSkillInstallContext) {
  const runner = context.remoteSkillCli?.update ?? defaultRemoteSkillUpdate;
  return runner();
}

async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, JSON.stringify(payload, null, 2));
}

function requireSkillInstallRepository(context: RuntimeSkillInstallContext): SkillInstallRepository {
  if (!context.skillInstallRepository) {
    throw new Error('skill_install_repository_required');
  }
  return context.skillInstallRepository;
}

async function defaultRemoteSkillInstall(params: { repo: string; skillName?: string }) {
  return execSkillsCommand(buildSkillsAddCommandPlan(params));
}

async function defaultRemoteSkillCheck() {
  return execSkillsCommand(buildSkillsCheckCommandPlan());
}

async function defaultRemoteSkillUpdate() {
  return execSkillsCommand(buildSkillsUpdateCommandPlan());
}
