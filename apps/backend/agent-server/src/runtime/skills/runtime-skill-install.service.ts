import { dirname, join, resolve } from 'node:path';
import { ensureDir, readFile, remove, writeFile } from 'fs-extra';

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
  normalizeOptionalSkillName
} from '@agent/skill-runtime';

import {
  buildSkillsAddCommand,
  buildSkillsCheckCommand,
  buildSkillsUpdateCommand,
  execShellCommand
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
  };
  listSkillSources: () => Promise<SkillSourceRecord[]>;
  registerInstalledSkillWorker: (skill: SkillCard) => void;
  remoteSkillCli?: {
    install: (params: { repo: string; skillName?: string }) => Promise<{ stdout: string; stderr: string }>;
    check: () => Promise<{ stdout: string; stderr: string }>;
    update: () => Promise<{ stdout: string; stderr: string }>;
  };
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
  return readJsonArray<SkillInstallReceipt>(join(context.settings.skillReceiptsRoot, 'receipts.json'));
}

export async function writeSkillInstallReceipt(
  context: RuntimeSkillInstallContext,
  receipt: SkillInstallReceipt
): Promise<void> {
  const receipts = await readSkillInstallReceipts(context);
  const deduped = receipts.filter(item => item.id !== receipt.id);
  deduped.push(receipt);
  await writeJsonFile(join(context.settings.skillReceiptsRoot, 'receipts.json'), deduped);
  await writeJsonFile(join(context.settings.skillReceiptsRoot, `${receipt.id}.json`), receipt);
}

export async function readInstalledSkillRecords(context: RuntimeSkillInstallContext): Promise<InstalledSkillRecord[]> {
  return readJsonArray<InstalledSkillRecord>(join(context.settings.skillPackagesRoot, 'installed.json'));
}

export async function writeInstalledSkillRecord(
  context: RuntimeSkillInstallContext,
  record: InstalledSkillRecord
): Promise<void> {
  const installed = await readInstalledSkillRecords(context);
  const deduped = installed.filter(item => !(item.skillId === record.skillId && item.version === record.version));
  deduped.push(record);
  await writeJsonFile(join(context.settings.skillPackagesRoot, 'installed.json'), deduped);
}

export async function finalizeSkillInstall(
  context: RuntimeSkillInstallContext,
  manifest: SkillManifestRecord,
  source: SkillSourceRecord,
  receipt: SkillInstallReceipt
): Promise<InstalledSkillRecord> {
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
    await remove(resolve(context.settings.workspaceRoot, 'data', 'skills', 'staging', receipt.id));
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

async function readJsonArray<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, JSON.stringify(payload, null, 2));
}

async function defaultRemoteSkillInstall(params: { repo: string; skillName?: string }) {
  const command = buildSkillsAddCommand(params);
  return execShellCommand(command);
}

async function defaultRemoteSkillCheck() {
  const command = buildSkillsCheckCommand();
  return execShellCommand(command);
}

async function defaultRemoteSkillUpdate() {
  const command = buildSkillsUpdateCommand();
  return execShellCommand(command);
}
