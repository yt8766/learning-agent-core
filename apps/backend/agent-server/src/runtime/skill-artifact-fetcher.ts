import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path';

import { SkillManifestRecord, SkillSourceRecord } from '@agent/shared';

export interface SkillArtifactFetchResult {
  stagingDir: string;
  artifactPath?: string;
  bytes?: number;
  integrityVerified: boolean;
  metadata: Record<string, unknown>;
}

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
}
