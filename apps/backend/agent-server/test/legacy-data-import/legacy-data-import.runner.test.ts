import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ensureDir, pathExists } from 'fs-extra';
import { describe, expect, it } from 'vitest';

import { parseBackendEnv } from '../../src/infrastructure/config/backend-env.schema';
import {
  createLegacyDataImportRunnerFromEnv,
  InMemoryLegacyDataImportRepository,
  LegacyDataImportRunner,
  SqlLegacyDataImportRepository
} from '../../src/runtime/legacy-data-import';

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
