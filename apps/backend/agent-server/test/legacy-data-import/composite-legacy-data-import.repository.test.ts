import { describe, expect, it, vi } from 'vitest';

import {
  CompositeLegacyDataImportRepository,
  InMemoryLegacyDataImportRepository,
  type LegacyDataImportDomainWriter,
  type LegacyDataImportRecord
} from '../../src/runtime/legacy-data-import';

describe('CompositeLegacyDataImportRepository', () => {
  it('stages a legacy record and forwards it to the matching domain writer only', async () => {
    const staging = new InMemoryLegacyDataImportRepository();
    const memoryWriter: LegacyDataImportDomainWriter = {
      importLegacyRecord: vi.fn(async () => undefined)
    };
    const skillsWriter: LegacyDataImportDomainWriter = {
      importLegacyRecord: vi.fn(async () => undefined)
    };
    const repository = new CompositeLegacyDataImportRepository(staging, {
      memory: memoryWriter,
      skills: skillsWriter
    });
    const record: LegacyDataImportRecord = {
      domain: 'memory',
      sourceFile: 'memory/records.jsonl',
      sourceFormat: 'jsonl',
      itemIndex: 0,
      lineNumber: 1,
      receiptKey: 'memory:memory/records.jsonl:0',
      payload: { id: 'memory-1', content: 'Remember repo rules' }
    };

    await repository.importLegacyRecord(record);

    expect(staging.records).toEqual([record]);
    expect(memoryWriter.importLegacyRecord).toHaveBeenCalledWith(record);
    expect(skillsWriter.importLegacyRecord).not.toHaveBeenCalled();
  });

  it('delegates receipt checks and receipt recording to the staging repository', async () => {
    const staging = new InMemoryLegacyDataImportRepository();
    const repository = new CompositeLegacyDataImportRepository(staging, {});
    const receipt = {
      receiptKey: 'rules:rules/rules.jsonl:0',
      domain: 'rules' as const,
      sourceFile: 'rules/rules.jsonl',
      sourceFormat: 'jsonl' as const,
      itemIndex: 0,
      lineNumber: 1,
      importedAt: '2026-05-09T00:00:00.000Z'
    };

    await expect(repository.hasReceipt(receipt.receiptKey)).resolves.toBe(false);
    await repository.recordReceipt(receipt);
    await repository.recordReceipt(receipt);

    await expect(repository.hasReceipt(receipt.receiptKey)).resolves.toBe(true);
    expect(staging.receipts).toEqual([receipt]);
  });

  it('propagates the original writer error after staging the legacy record', async () => {
    const staging = new InMemoryLegacyDataImportRepository();
    const writerError = new Error('rules_schema_mismatch');
    const record: LegacyDataImportRecord = {
      domain: 'rules',
      sourceFile: 'rules/rules.jsonl',
      sourceFormat: 'jsonl',
      itemIndex: 0,
      lineNumber: 1,
      receiptKey: 'rules:rules/rules.jsonl:0',
      payload: { bad: true }
    };
    const repository = new CompositeLegacyDataImportRepository(staging, {
      rules: {
        importLegacyRecord: vi.fn(async () => {
          throw writerError;
        })
      }
    });

    await expect(repository.importLegacyRecord(record)).rejects.toBe(writerError);
    expect(staging.records).toEqual([record]);
  });
});
