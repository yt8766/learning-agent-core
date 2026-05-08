import type { InstalledSkillRecord, SkillInstallReceipt } from '@agent/core';

export interface SkillInstallRepository {
  listReceipts(): Promise<SkillInstallReceipt[]>;
  saveReceipt(receipt: SkillInstallReceipt): Promise<void>;
  listInstalledRecords(): Promise<InstalledSkillRecord[]>;
  saveInstalledRecord(record: InstalledSkillRecord): Promise<void>;
}

export class MemorySkillInstallRepository implements SkillInstallRepository {
  private readonly receipts = new Map<string, SkillInstallReceipt>();
  private readonly installedRecords = new Map<string, InstalledSkillRecord>();

  async listReceipts(): Promise<SkillInstallReceipt[]> {
    return Array.from(this.receipts.values()).map(receipt => ({ ...receipt }));
  }

  async saveReceipt(receipt: SkillInstallReceipt): Promise<void> {
    this.receipts.set(receipt.id, { ...receipt });
  }

  async listInstalledRecords(): Promise<InstalledSkillRecord[]> {
    return Array.from(this.installedRecords.values()).map(record => ({ ...record }));
  }

  async saveInstalledRecord(record: InstalledSkillRecord): Promise<void> {
    this.installedRecords.set(buildInstalledRecordKey(record), { ...record });
  }
}

function buildInstalledRecordKey(record: Pick<InstalledSkillRecord, 'skillId' | 'version'>): string {
  return `${record.skillId}@${record.version}`;
}
