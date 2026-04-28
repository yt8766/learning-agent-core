import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path';

import type { SkillManifestRecord, SkillSourceRecord } from '@agent/core';

export interface SkillArtifactFetchResult {
  stagingDir: string;
  artifactPath?: string;
  bytes?: number;
  integrityVerified: boolean;
  metadata: Record<string, unknown>;
}

const WORKSPACE_DRAFT_ENTRY_PREFIX = 'workspace-draft:';

function resolvePath(candidate: string, workspaceRoot: string): string {
  return isAbsolute(candidate) ? candidate : resolve(workspaceRoot, candidate);
}

export class SkillArtifactFetcher {
  constructor(private readonly workspaceRoot: string) {}

  async fetchToStaging(
    manifest: SkillManifestRecord,
    source: SkillSourceRecord,
    receiptId: string
  ): Promise<SkillArtifactFetchResult> {
    const stagingDir = resolve(this.workspaceRoot, 'data', 'skills', 'staging', receiptId);
    await rm(stagingDir, { recursive: true, force: true });
    await mkdir(stagingDir, { recursive: true });

    const target = manifest.artifactUrl ?? manifest.entry;
    if (!target) {
      const fallbackPath = join(stagingDir, 'manifest.json');
      await writeFile(fallbackPath, JSON.stringify({ manifest, source }, null, 2));
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
      const artifactPath = join(stagingDir, filename);
      await writeFile(artifactPath, bytes);
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
      const destDir = join(stagingDir, basename(sourcePath));
      await cp(sourcePath, destDir, { recursive: true });
      return {
        stagingDir,
        artifactPath: destDir,
        integrityVerified: Boolean(manifest.integrity),
        metadata: { mode: 'directory-copy' }
      };
    }

    const filename = basename(sourcePath);
    const destPath = join(stagingDir, filename);
    if (extname(filename).toLowerCase() === '.json') {
      const raw = await readFile(sourcePath, 'utf8');
      await writeFile(destPath, raw);
    } else {
      await cp(sourcePath, destPath);
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
    await mkdir(dirname(installDir), { recursive: true });
    await rm(installDir, { recursive: true, force: true });
    await cp(stagingDir, installDir, { recursive: true });
    await rm(stagingDir, { recursive: true, force: true });
  }

  private async materializeWorkspaceDraft(
    manifest: SkillManifestRecord,
    source: SkillSourceRecord,
    stagingDir: string,
    draftId: string
  ): Promise<SkillArtifactFetchResult> {
    const draftsPath = resolve(this.workspaceRoot, 'data', 'skills', 'drafts', 'workspace-drafts.json');
    const raw = await readFile(draftsPath, 'utf8');
    const drafts = JSON.parse(raw) as Array<{
      id?: string;
      workspaceId?: string;
      title?: string;
      description?: string;
      bodyMarkdown?: string;
      requiredTools?: string[];
      requiredConnectors?: string[];
      sourceTaskId?: string;
      sourceEvidenceIds?: string[];
      riskLevel?: string;
      confidence?: number;
      status?: string;
      approvedBy?: string;
      approvedAt?: string;
      updatedAt?: string;
    }>;
    const draft = drafts.find(candidate => candidate.id === draftId);
    if (!draft) {
      throw new Error(`workspace_draft_not_found:${draftId}`);
    }
    if (draft.status !== 'active' && draft.status !== 'trusted') {
      throw new Error(`workspace_draft_not_installable:${draftId}`);
    }
    if (!draft.bodyMarkdown) {
      throw new Error(`workspace_draft_body_missing:${draftId}`);
    }

    const skillPath = join(stagingDir, 'SKILL.md');
    await writeFile(skillPath, draft.bodyMarkdown, 'utf8');
    await writeFile(
      join(stagingDir, 'manifest.json'),
      `${JSON.stringify({ manifest, source, draft: toWorkspaceDraftArtifactProjection(draft) }, null, 2)}\n`,
      'utf8'
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
}

function parseWorkspaceDraftEntry(target: string): string | undefined {
  if (!target.startsWith(WORKSPACE_DRAFT_ENTRY_PREFIX)) {
    return undefined;
  }

  const draftId = target.slice(WORKSPACE_DRAFT_ENTRY_PREFIX.length).trim();
  return draftId || undefined;
}

function toWorkspaceDraftArtifactProjection(draft: {
  id?: string;
  workspaceId?: string;
  title?: string;
  description?: string;
  requiredTools?: string[];
  requiredConnectors?: string[];
  sourceTaskId?: string;
  sourceEvidenceIds?: string[];
  riskLevel?: string;
  confidence?: number;
  status?: string;
  approvedBy?: string;
  approvedAt?: string;
  updatedAt?: string;
}) {
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
