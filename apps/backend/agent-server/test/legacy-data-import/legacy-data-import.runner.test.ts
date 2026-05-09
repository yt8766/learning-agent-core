import { copyFile, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ensureDir, pathExists } from 'fs-extra';
import { describe, expect, it, vi } from 'vitest';

import { parseBackendEnv } from '../../src/infrastructure/config/backend-env.schema';
import {
  createLegacyDataImportRunnerFromEnv,
  CompositeLegacyDataImportRepository,
  InMemoryLegacyDataImportRepository,
  LegacyDataImportRunner,
  type LegacyDataImportDomainWriters,
  SqlLegacyDataImportRepository
} from '../../src/runtime/legacy-data-import';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));

describe('LegacyDataImportRunner', () => {
  it('imports legacy JSON and JSONL data once and records receipts without deleting source files', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'legacy-data-import-'));
    await ensureDir(join(dataRoot, 'runtime'));
    await ensureDir(join(dataRoot, 'memory'));

    const runtimeFile = join(dataRoot, 'runtime', 'sessions.json');
    const memoryFile = join(dataRoot, 'memory', 'memories.jsonl');
    await writeFile(runtimeFile, JSON.stringify([{ id: 'run-1' }, { id: 'run-2' }]), 'utf8');
    await writeFile(
      memoryFile,
      `${JSON.stringify({ id: 'memory-1' })}\n${JSON.stringify({ id: 'memory-2' })}\n`,
      'utf8'
    );

    const repository = new InMemoryLegacyDataImportRepository();
    const runner = new LegacyDataImportRunner({ dataRoot, repository });

    await expect(runner.runOnce()).resolves.toEqual(
      expect.objectContaining({
        imported: 4,
        skipped: 0,
        errors: 0
      })
    );
    await expect(runner.runOnce()).resolves.toEqual(
      expect.objectContaining({
        imported: 0,
        skipped: 4,
        errors: 0
      })
    );

    expect(repository.records).toHaveLength(4);
    expect(repository.receipts).toHaveLength(4);
    expect(repository.errors).toHaveLength(0);
    await expect(pathExists(runtimeFile)).resolves.toBe(true);
    await expect(pathExists(memoryFile)).resolves.toBe(true);
    await expect(readFile(memoryFile, 'utf8')).resolves.toContain('memory-2');
  });

  it('records parse errors with source metadata and continues importing valid lines', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'legacy-data-import-errors-'));
    await ensureDir(join(dataRoot, 'rules'));
    const rulesFile = join(dataRoot, 'rules', 'rules.jsonl');
    await writeFile(rulesFile, `${JSON.stringify({ id: 'rule-1' })}\n{bad json}\n`, 'utf8');

    const repository = new InMemoryLegacyDataImportRepository();
    const runner = new LegacyDataImportRunner({ dataRoot, repository });

    const result = await runner.runOnce();

    expect(result.imported).toBe(1);
    expect(result.errors).toBe(1);
    expect(repository.records).toEqual([
      expect.objectContaining({
        domain: 'rules',
        sourceFile: 'rules/rules.jsonl',
        payload: { id: 'rule-1' }
      })
    ]);
    expect(repository.errors).toEqual([
      expect.objectContaining({
        domain: 'rules',
        sourceFile: 'rules/rules.jsonl',
        lineNumber: 2,
        errorCode: 'parse_error'
      })
    ]);
    await runner.runOnce();
    expect(repository.errors).toHaveLength(1);
    await expect(pathExists(rulesFile)).resolves.toBe(true);
  });

  it('imports the preserved legacy rules fixture after root data deletion', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'legacy-data-import-rules-fixture-'));
    await ensureDir(join(dataRoot, 'rules'));
    const rulesFile = join(dataRoot, 'rules', 'rules.jsonl');
    await copyFile(join(TEST_DIR, 'fixtures', 'rules.jsonl'), rulesFile);

    const repository = new InMemoryLegacyDataImportRepository();
    const runner = new LegacyDataImportRunner({ dataRoot, repository });

    await expect(runner.runOnce()).resolves.toEqual(
      expect.objectContaining({
        imported: 2,
        skipped: 0,
        errors: 0
      })
    );
    expect(repository.records.map(record => (record.payload as { id: string }).id)).toEqual([
      'rule_1777210584484',
      'rule_1777718173196'
    ]);
  });

  it('creates a Postgres-ready runner when LEGACY_DATA_IMPORT=once has DATABASE_URL', async () => {
    const queries: string[] = [];
    const client = {
      query: async (text: string) => {
        queries.push(text);
        return { rows: [] };
      }
    };

    const result = await createLegacyDataImportRunnerFromEnv({
      env: {
        LEGACY_DATA_IMPORT: 'once',
        DATABASE_URL: 'postgres://legacy-import'
      },
      createSqlClient: () => client
    });

    expect(result.enabled).toBe(true);
    expect(result.runner).toBeInstanceOf(LegacyDataImportRunner);
    expect(result.repository).toBeInstanceOf(SqlLegacyDataImportRepository);
    expect(queries[0]).toContain('create table if not exists legacy_data_import_receipts');
  });

  it('fails fast when legacy import requests postgres staging without DATABASE_URL', async () => {
    await expect(
      createLegacyDataImportRunnerFromEnv({
        env: {
          LEGACY_DATA_IMPORT: 'once',
          BACKEND_PERSISTENCE: 'postgres',
          DB_HOST: 'db.local'
        }
      })
    ).rejects.toThrow(/LEGACY_DATA_IMPORT=once requires DATABASE_URL/);
  });

  it('wraps the staging repository with domain writers without invoking writers during bootstrap', async () => {
    const domainWriters: LegacyDataImportDomainWriters = {
      rules: {
        importLegacyRecord: vi.fn(async () => undefined)
      }
    };

    const result = await createLegacyDataImportRunnerFromEnv({
      env: {
        LEGACY_DATA_IMPORT: 'once'
      },
      domainWriters
    });

    expect(result.enabled).toBe(true);
    expect(result.runner).toBeInstanceOf(LegacyDataImportRunner);
    expect(result.repository).toBeInstanceOf(CompositeLegacyDataImportRepository);
    expect(domainWriters.rules?.importLegacyRecord).not.toHaveBeenCalled();
  });

  it('accepts legacy import env flags in backend env parsing', () => {
    expect(
      parseBackendEnv({
        LEGACY_DATA_IMPORT: 'once',
        LEGACY_DATA_ROOT: '/workspace/data'
      } as NodeJS.ProcessEnv)
    ).toEqual(
      expect.objectContaining({
        LEGACY_DATA_IMPORT: 'once',
        LEGACY_DATA_ROOT: '/workspace/data'
      })
    );
  });
});
