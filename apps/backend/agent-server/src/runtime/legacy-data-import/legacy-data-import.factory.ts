import { Pool } from 'pg';

import { CompositeLegacyDataImportRepository } from './composite-legacy-data-import.repository';
import { InMemoryLegacyDataImportRepository } from './in-memory-legacy-data-import.repository';
import { LegacyDataImportRunner } from './legacy-data-import.runner';
import type { LegacyDataImportDomainWriters } from './legacy-data-import-domain-writer';
import type { LegacyDataImportRepository } from './legacy-data-import.types';
import { SqlLegacyDataImportRepository, type LegacyDataImportSqlClient } from './sql-legacy-data-import.repository';

export interface LegacyDataImportRunnerFactoryOptions {
  env?: NodeJS.ProcessEnv;
  dataRoot?: string;
  repository?: LegacyDataImportRepository;
  domainWriters?: LegacyDataImportDomainWriters;
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
  const stagingRepository = options.repository ?? (await createRepository(env, options.createSqlClient));
  const repository = options.domainWriters
    ? new CompositeLegacyDataImportRepository(stagingRepository, options.domainWriters)
    : stagingRepository;
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
  if (env.BACKEND_PERSISTENCE === 'postgres' && !databaseUrl) {
    throw new Error('LEGACY_DATA_IMPORT=once requires DATABASE_URL when BACKEND_PERSISTENCE=postgres');
  }
  if (!databaseUrl) {
    return new InMemoryLegacyDataImportRepository();
  }

  const client = createSqlClient?.(databaseUrl) ?? new Pool({ connectionString: databaseUrl });
  const repository = new SqlLegacyDataImportRepository(client);
  await repository.ensureSchema();
  return repository;
}
