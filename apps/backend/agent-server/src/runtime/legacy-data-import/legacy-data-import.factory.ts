import { Pool } from 'pg';

import { InMemoryLegacyDataImportRepository } from './in-memory-legacy-data-import.repository';
import { LegacyDataImportRunner } from './legacy-data-import.runner';
import type { LegacyDataImportRepository } from './legacy-data-import.types';
import { SqlLegacyDataImportRepository, type LegacyDataImportSqlClient } from './sql-legacy-data-import.repository';

export interface LegacyDataImportRunnerFactoryOptions {
  env?: NodeJS.ProcessEnv;
  dataRoot?: string;
  repository?: LegacyDataImportRepository;
  createSqlClient?: (databaseUrl: string) => LegacyDataImportSqlClient;
}

export interface LegacyDataImportRunnerFactoryResult {
  enabled: boolean;
  runner?: LegacyDataImportRunner;
  repository?: LegacyDataImportRepository;
}

export async function createLegacyDataImportRunnerFromEnv(
  options: LegacyDataImportRunnerFactoryOptions = {}
): Promise<LegacyDataImportRunnerFactoryResult> {
  const env = options.env ?? process.env;
  if (env.LEGACY_DATA_IMPORT !== 'once') {
    return { enabled: false };
  }

  const dataRoot = options.dataRoot ?? env.LEGACY_DATA_ROOT ?? 'data';
  const repository = options.repository ?? (await createRepository(env, options.createSqlClient));
  return {
    enabled: true,
    repository,
    runner: new LegacyDataImportRunner({ dataRoot, repository })
  };
}

async function createRepository(
  env: NodeJS.ProcessEnv,
  createSqlClient?: (databaseUrl: string) => LegacyDataImportSqlClient
): Promise<LegacyDataImportRepository> {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return new InMemoryLegacyDataImportRepository();
  }

  const client = createSqlClient?.(databaseUrl) ?? new Pool({ connectionString: databaseUrl });
  const repository = new SqlLegacyDataImportRepository(client);
  await repository.ensureSchema();
  return repository;
}
