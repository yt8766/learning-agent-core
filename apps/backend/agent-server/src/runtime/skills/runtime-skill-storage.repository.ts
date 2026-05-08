import { dirname, join, resolve } from 'node:path';

import { copy, ensureDir, pathExists, readJson, remove, writeFile, writeJson } from 'fs-extra';

import type { InstalledSkillRecord, SkillInstallReceipt } from '@agent/core';
import {
  FileSkillDraftRepository,
  type SkillArtifactStorageRepository,
  type SkillDraftRepository,
  type SkillInstallRepository,
  type SkillSourceRemoteCachePayload,
  type SkillSourceRemoteCacheRepository,
  type SkillSourceRemoteCacheWriteResult
} from '@agent/skill';

export class RuntimeSkillInstallRepository implements SkillInstallRepository {
  constructor(
    private readonly options: {
      receiptsRoot: string;
      installedRoot: string;
    }
  ) {}

  async listReceipts(): Promise<SkillInstallReceipt[]> {
    const receiptsPath = this.resolveReceiptsIndexPath();
    if (!(await pathExists(receiptsPath))) {
      return [];
    }
    return (await readJson(receiptsPath)) as SkillInstallReceipt[];
  }

  async saveReceipt(receipt: SkillInstallReceipt): Promise<void> {
    const receipts = await this.listReceipts();
    const deduped = receipts.filter(item => item.id !== receipt.id);
    deduped.push({ ...receipt });
    await ensureDir(this.options.receiptsRoot);
    await writeJson(this.resolveReceiptsIndexPath(), deduped, { spaces: 2 });
    await writeJson(join(this.options.receiptsRoot, `${receipt.id}.json`), receipt, { spaces: 2 });
  }

  async listInstalledRecords(): Promise<InstalledSkillRecord[]> {
    const installedPath = this.resolveInstalledIndexPath();
    if (!(await pathExists(installedPath))) {
      return [];
    }
    return (await readJson(installedPath)) as InstalledSkillRecord[];
  }

  async saveInstalledRecord(record: InstalledSkillRecord): Promise<void> {
    const installed = await this.listInstalledRecords();
    const deduped = installed.filter(item => !(item.skillId === record.skillId && item.version === record.version));
    deduped.push({ ...record });
    await ensureDir(this.options.installedRoot);
    await writeJson(this.resolveInstalledIndexPath(), deduped, { spaces: 2 });
  }

  private resolveReceiptsIndexPath(): string {
    return join(this.options.receiptsRoot, 'receipts.json');
  }

  private resolveInstalledIndexPath(): string {
    return join(this.options.installedRoot, 'installed.json');
  }
}

export class RuntimeSkillSourceRemoteCacheRepository implements SkillSourceRemoteCacheRepository {
  constructor(private readonly workspaceRoot: string) {}

  async write(sourceId: string, payload: SkillSourceRemoteCachePayload): Promise<SkillSourceRemoteCacheWriteResult> {
    const cacheFilePath = this.resolveCacheFilePath(sourceId);
    await ensureDir(dirname(cacheFilePath));
    await writeJson(cacheFilePath, payload, { spaces: 2 });
    return { cacheFilePath };
  }

  async read(sourceId: string): Promise<SkillSourceRemoteCachePayload | undefined> {
    const cacheFilePath = this.resolveCacheFilePath(sourceId);
    if (!(await pathExists(cacheFilePath))) {
      return undefined;
    }
    return (await readJson(cacheFilePath)) as SkillSourceRemoteCachePayload;
  }

  private resolveCacheFilePath(sourceId: string): string {
    return resolve(this.workspaceRoot, 'data', 'skills', 'remote-sources', sourceId, 'index.json');
  }
}

export class RuntimeSkillArtifactStorageRepository implements SkillArtifactStorageRepository {
  constructor(private readonly workspaceRoot: string) {}

  async prepareStaging(receiptId: string): Promise<string> {
    const stagingDir = this.resolveStagingDir(receiptId);
    await remove(stagingDir);
    await ensureDir(stagingDir);
    return stagingDir;
  }

  async writeText(stagingDir: string, relativePath: string, content: string): Promise<string> {
    const targetPath = join(stagingDir, relativePath);
    await ensureDir(dirname(targetPath));
    await writeFile(targetPath, content, 'utf8');
    return targetPath;
  }

  async writeBytes(stagingDir: string, relativePath: string, bytes: Uint8Array): Promise<string> {
    const targetPath = join(stagingDir, relativePath);
    await ensureDir(dirname(targetPath));
    await writeFile(targetPath, bytes);
    return targetPath;
  }

  async copyPathToStaging(stagingDir: string, sourcePath: string, relativePath: string): Promise<string> {
    const targetPath = join(stagingDir, relativePath);
    await remove(targetPath);
    await ensureDir(dirname(targetPath));
    await copy(sourcePath, targetPath);
    return targetPath;
  }

  async promoteFromStaging(stagingDir: string, installDir: string): Promise<void> {
    await ensureDir(dirname(installDir));
    await remove(installDir);
    await copy(stagingDir, installDir);
    await remove(stagingDir);
  }

  async removeStaging(stagingDir: string): Promise<void> {
    await remove(stagingDir);
  }

  async removeStagingByReceiptId(receiptId: string): Promise<void> {
    await remove(this.resolveStagingDir(receiptId));
  }

  private resolveStagingDir(receiptId: string): string {
    return resolve(this.workspaceRoot, 'data', 'skills', 'staging', receiptId);
  }
}

export function createRuntimeSkillDraftRepository(workspaceRoot: string): SkillDraftRepository {
  return new FileSkillDraftRepository({
    filePath: resolve(workspaceRoot, 'data', 'skills', 'drafts', 'workspace-drafts.json')
  });
}
