import { describe, expect, it, vi } from 'vitest';

import {
  SqlLegacyDataImportRepository,
  type LegacyDataImportSqlClient
} from '../../src/runtime/legacy-data-import/sql-legacy-data-import.repository';

function createMockClient(rows: Array<Record<string, unknown>> = []): LegacyDataImportSqlClient {
  return {
    query: vi.fn().mockResolvedValue({ rows })
  };
}

describe('SqlLegacyDataImportRepository', () => {
  describe('ensureSchema', () => {
    it('executes the schema creation SQL', async () => {
      const client = createMockClient();
      const repo = new SqlLegacyDataImportRepository(client);

      await repo.ensureSchema();

      expect(client.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('hasReceipt', () => {
    it('returns true when receipt exists', async () => {
      const client = createMockClient([{ receipt_key: 'rk-1' }]);
      const repo = new SqlLegacyDataImportRepository(client);

      const result = await repo.hasReceipt('rk-1');

      expect(result).toBe(true);
    });

    it('returns false when receipt does not exist', async () => {
      const client = createMockClient([]);
      const repo = new SqlLegacyDataImportRepository(client);

      const result = await repo.hasReceipt('missing');

      expect(result).toBe(false);
    });
  });

  describe('importLegacyRecord', () => {
    it('inserts a legacy record with all fields', async () => {
      const client = createMockClient();
      const repo = new SqlLegacyDataImportRepository(client);

      await repo.importLegacyRecord({
        receiptKey: 'rk-1',
        domain: 'knowledge',
        sourceFile: 'data.json',
        sourceFormat: 'json',
        itemIndex: 0,
        lineNumber: 42,
        payload: { title: 'Test' }
      });

      expect(client.query).toHaveBeenCalledTimes(1);
    });

    it('inserts a legacy record with null lineNumber', async () => {
      const client = createMockClient();
      const repo = new SqlLegacyDataImportRepository(client);

      await repo.importLegacyRecord({
        receiptKey: 'rk-2',
        domain: 'knowledge',
        sourceFile: 'data.json',
        sourceFormat: 'json',
        itemIndex: 1,
        payload: { title: 'Test 2' }
      });

      expect(client.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('recordReceipt', () => {
    it('inserts a receipt record', async () => {
      const client = createMockClient();
      const repo = new SqlLegacyDataImportRepository(client);

      await repo.recordReceipt({
        receiptKey: 'rk-1',
        domain: 'knowledge',
        sourceFile: 'data.json',
        sourceFormat: 'json',
        itemIndex: 0,
        lineNumber: 42,
        importedAt: '2026-05-10T00:00:00.000Z'
      });

      expect(client.query).toHaveBeenCalledTimes(1);
    });

    it('inserts a receipt with null lineNumber', async () => {
      const client = createMockClient();
      const repo = new SqlLegacyDataImportRepository(client);

      await repo.recordReceipt({
        receiptKey: 'rk-2',
        domain: 'knowledge',
        sourceFile: 'data.json',
        sourceFormat: 'json',
        itemIndex: 1,
        importedAt: '2026-05-10T00:00:00.000Z'
      });

      expect(client.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('hasError', () => {
    it('returns true when error exists', async () => {
      const client = createMockClient([{ error_key: 'ek-1' }]);
      const repo = new SqlLegacyDataImportRepository(client);

      const result = await repo.hasError('ek-1');

      expect(result).toBe(true);
    });

    it('returns false when error does not exist', async () => {
      const client = createMockClient([]);
      const repo = new SqlLegacyDataImportRepository(client);

      const result = await repo.hasError('missing');

      expect(result).toBe(false);
    });
  });

  describe('recordError', () => {
    it('inserts an error record', async () => {
      const client = createMockClient();
      const repo = new SqlLegacyDataImportRepository(client);

      await repo.recordError({
        errorKey: 'ek-1',
        domain: 'knowledge',
        sourceFile: 'data.json',
        sourceFormat: 'json',
        errorCode: 'PARSE_ERROR',
        message: 'Invalid JSON',
        lineNumber: 10,
        recordedAt: '2026-05-10T00:00:00.000Z'
      });

      expect(client.query).toHaveBeenCalledTimes(1);
    });

    it('inserts an error with null lineNumber', async () => {
      const client = createMockClient();
      const repo = new SqlLegacyDataImportRepository(client);

      await repo.recordError({
        errorKey: 'ek-2',
        domain: 'knowledge',
        sourceFile: 'data.json',
        sourceFormat: 'json',
        errorCode: 'PARSE_ERROR',
        message: 'Invalid JSON',
        recordedAt: '2026-05-10T00:00:00.000Z'
      });

      expect(client.query).toHaveBeenCalledTimes(1);
    });
  });
});
