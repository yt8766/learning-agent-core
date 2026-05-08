import { readFile, stat } from 'node:fs/promises';
import { basename, extname, isAbsolute, join, resolve } from 'node:path';

import type { SkillManifestRecord, SkillSourceRecord } from '@agent/core';
import type { SkillDraftRecord, SkillDraftRepository } from '../drafts';

export interface SkillArtifactFetchResult {
  stagingDir: string;
  artifactPath?: string;
  bytes?: number;
  integrityVerified: boolean;
  metadata: Record<string, unknown>;
}

export interface SkillArtifactStorageRepository {
  prepareStaging(receiptId: string): Promise<string>;
  writeText(stagingDir: string, relativePath: string, content: string): Promise<string>;
  writeBytes(stagingDir: string, relativePath: string, bytes: Uint8Array): Promise<string>;
  copyPathToStaging(stagingDir: string, sourcePath: string, relativePath: string): Promise<string>;
  promoteFromStaging(stagingDir: string, installDir: string): Promise<void>;
  removeStaging(stagingDir: string): Promise<void>;
  removeStagingByReceiptId(receiptId: string): Promise<void>;
}

export interface SkillArtifactFetcherOptions {
  workspaceRoot: string;
  storageRepository: SkillArtifactStorageRepository;
  skillDraftRepository?: SkillDraftRepository;
}

const WORKSPACE_DRAFT_ENTRY_PREFIX = 'workspace-draft:';

function resolvePath(candidate: string, workspaceRoot: string): string {
  return isAbsolute(candidate) ? candidate : resolve(workspaceRoot, candidate);
}

export class SkillArtifactFetcher {
  private readonly workspaceRoot: string;
  private readonly storageRepository?: SkillArtifactStorageRepository;
  private readonly skillDraftRepository?: SkillDraftRepository;

  constructor(workspaceRoot: string, options?: Partial<Omit<SkillArtifactFetcherOptions, 'workspaceRoot'>>);
  constructor(options: SkillArtifactFetcherOptions);
  constructor(
    input: string | SkillArtifactFetcherOptions,
    options: Partial<Omit<SkillArtifactFetcherOptions, 'workspaceRoot'>> = {}
  ) {
    if (typeof input === 'string') {
      this.workspaceRoot = input;
      this.storageRepository = options.storageRepository;
      this.skillDraftRepository = options.skillDraftRepository;
      return;
    }

    this.workspaceRoot = input.workspaceRoot;
    this.storageRepository = input.storageRepository;
    this.skillDraftRepository = input.skillDraftRepository;
  }

  async fetchToStaging(
    manifest: SkillManifestRecord,
    source: SkillSourceRecord,
    receiptId: string
  ): Promise<SkillArtifactFetchResult> {
    const storageRepository = this.requireStorageRepository();
    const stagingDir = await storageRepository.prepareStaging(receiptId);

    const target = manifest.artifactUrl ?? manifest.entry;
    if (!target) {
      const fallbackPath = await storageRepository.writeText(
        stagingDir,
        'manifest.json',
        JSON.stringify({ manifest, source }, null, 2)
      );
      return {
        stagingDir,
        artifactPath: fallbackPath,
        integrityVerified: false,
        metadata: { mode: 'manifest-only' }
      };
    }

    const workspaceDraftId = parseWorkspaceDraftEntry(target);
    if (workspaceDraftId) {
      return this.materializeWorkspaceDraft(manifest, source, stagingDir, workspaceDraftId);
    }

    if (target.startsWith('http://') || target.startsWith('https://')) {
      const response = await fetch(target);
      if (!response.ok) {
        throw new Error(`artifact_fetch_http_${response.status}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const filename = basename(new URL(target).pathname || `${manifest.id}.artifact`);
      const artifactPath = await storageRepository.writeBytes(stagingDir, filename, bytes);
      return {
        stagingDir,
        artifactPath,
        bytes: bytes.byteLength,
        integrityVerified: Boolean(manifest.integrity),
        metadata: { mode: 'remote-download', filename }
      };
    }

    const sourcePath = resolvePath(target, this.workspaceRoot);
    const fileStat = await stat(sourcePath);
    if (fileStat.isDirectory()) {
      const destDir = await storageRepository.copyPathToStaging(stagingDir, sourcePath, basename(sourcePath));
      return {
        stagingDir,
        artifactPath: destDir,
        integrityVerified: Boolean(manifest.integrity),
        metadata: { mode: 'directory-copy' }
      };
    }

    const filename = basename(sourcePath);
    let destPath: string;
    if (extname(filename).toLowerCase() === '.json') {
      const raw = await readFile(sourcePath, 'utf8');
      destPath = await storageRepository.writeText(stagingDir, filename, raw);
    } else {
      destPath = await storageRepository.copyPathToStaging(stagingDir, sourcePath, filename);
    }
    return {
      stagingDir,
      artifactPath: destPath,
      bytes: fileStat.size,
      integrityVerified: Boolean(manifest.integrity),
      metadata: { mode: 'file-copy', filename }
    };
  }

  async promoteFromStaging(stagingDir: string, installDir: string): Promise<void> {
    await this.requireStorageRepository().promoteFromStaging(stagingDir, installDir);
  }

  async removeStaging(stagingDir: string): Promise<void> {
    await this.requireStorageRepository().removeStaging(stagingDir);
  }

  async removeStagingByReceiptId(receiptId: string): Promise<void> {
    await this.requireStorageRepository().removeStagingByReceiptId(receiptId);
  }

  private async materializeWorkspaceDraft(
    manifest: SkillManifestRecord,
    source: SkillSourceRecord,
    stagingDir: string,
    draftId: string
  ): Promise<SkillArtifactFetchResult> {
    const storageRepository = this.requireStorageRepository();
    const draft = await this.requireSkillDraftRepository().get(draftId);
    if (!draft) {
      throw new Error(`workspace_draft_not_found:${draftId}`);
    }
    if (draft.status !== 'active' && draft.status !== 'trusted') {
      throw new Error(`workspace_draft_not_installable:${draftId}`);
    }
    if (!draft.bodyMarkdown) {
      throw new Error(`workspace_draft_body_missing:${draftId}`);
    }

    const skillPath = await storageRepository.writeText(stagingDir, 'SKILL.md', draft.bodyMarkdown);
    await storageRepository.writeText(
      stagingDir,
      'manifest.json',
      `${JSON.stringify({ manifest, source, draft: toWorkspaceDraftArtifactProjection(draft) }, null, 2)}\n`
    );

    return {
      stagingDir,
      artifactPath: skillPath,
      bytes: Buffer.byteLength(draft.bodyMarkdown, 'utf8'),
      integrityVerified: true,
      metadata: {
        mode: 'workspace-draft',
        draftId
      }
    };
  }

  private requireStorageRepository(): SkillArtifactStorageRepository {
    if (!this.storageRepository) {
      throw new Error('skill_artifact_storage_repository_required');
    }
    return this.storageRepository;
  }

  private requireSkillDraftRepository(): SkillDraftRepository {
    if (!this.skillDraftRepository) {
      throw new Error('skill_draft_repository_required');
    }
    return this.skillDraftRepository;
  }
}

function parseWorkspaceDraftEntry(target: string): string | undefined {
  if (!target.startsWith(WORKSPACE_DRAFT_ENTRY_PREFIX)) {
    return undefined;
  }

  const draftId = target.slice(WORKSPACE_DRAFT_ENTRY_PREFIX.length).trim();
  return draftId || undefined;
}

function toWorkspaceDraftArtifactProjection(draft: SkillDraftRecord) {
  return {
    id: draft.id,
    workspaceId: draft.workspaceId,
    title: draft.title,
    description: draft.description,
    requiredTools: draft.requiredTools ?? [],
    requiredConnectors: draft.requiredConnectors ?? [],
    sourceTaskId: draft.sourceTaskId,
    sourceEvidenceIds: draft.sourceEvidenceIds ?? [],
    riskLevel: draft.riskLevel,
    confidence: draft.confidence,
    status: draft.status,
    approvedBy: draft.approvedBy,
    approvedAt: draft.approvedAt,
    updatedAt: draft.updatedAt
  };
}
