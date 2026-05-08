import type { DynamicModule, Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import type { BackendPersistenceMode } from './infrastructure/config/backend-env.schema';
import { WorkflowRun } from './workflow-runs/entities/workflow-run.entity';
import { WorkflowRunsModule } from './workflow-runs/workflow-runs.module';

export type PersistenceImport = DynamicModule | Type<unknown>;

export interface AppPersistenceEnv {
  BACKEND_PERSISTENCE?: string;
  DATABASE_URL?: string;
  DB_HOST?: string;
  DB_PORT?: string;
  DB_USER?: string;
  DB_PASS?: string;
  DB_NAME?: string;
  NODE_ENV?: string;
  AGENT_SERVER_ENABLE_DATABASE_IN_TEST?: string;
}

export function resolveBackendPersistenceMode(env: AppPersistenceEnv = process.env): BackendPersistenceMode {
  if (env.AGENT_SERVER_ENABLE_DATABASE_IN_TEST === 'true') {
    if (!env.DATABASE_URL && !env.DB_HOST) {
      throw new Error('DATABASE_URL or DB_HOST is required when AGENT_SERVER_ENABLE_DATABASE_IN_TEST=true');
    }

    return 'postgres';
  }

  const mode = env.BACKEND_PERSISTENCE ?? 'memory';
  if (mode !== 'memory' && mode !== 'postgres') {
    throw new Error(`Unsupported BACKEND_PERSISTENCE mode: ${mode}`);
  }

  if (mode === 'postgres' && !env.DATABASE_URL && !env.DB_HOST) {
    throw new Error('DATABASE_URL or DB_HOST is required when BACKEND_PERSISTENCE=postgres');
  }

  return mode;
}

export function shouldEnablePersistence(env: AppPersistenceEnv = process.env): boolean {
  return resolveBackendPersistenceMode(env) === 'postgres';
}

export function createPersistenceImports(env: AppPersistenceEnv = process.env): PersistenceImport[] {
  if (!shouldEnablePersistence(env)) {
    return [];
  }

  return [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: env.DATABASE_URL,
      host: env.DATABASE_URL ? undefined : env.DB_HOST,
      port: env.DATABASE_URL ? undefined : parseInt(env.DB_PORT ?? '5432', 10),
      username: env.DATABASE_URL ? undefined : (env.DB_USER ?? 'postgres'),
      password: env.DATABASE_URL ? undefined : (env.DB_PASS ?? 'postgres'),
      database: env.DATABASE_URL ? undefined : (env.DB_NAME ?? 'agent_db'),
      entities: [WorkflowRun],
      synchronize: false
    }),
    WorkflowRunsModule
  ];
}
