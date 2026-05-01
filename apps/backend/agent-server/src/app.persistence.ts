import type { DynamicModule, Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkflowRun } from './workflow-runs/entities/workflow-run.entity';
import { WorkflowRunsModule } from './workflow-runs/workflow-runs.module';

export type PersistenceImport = DynamicModule | Type<unknown>;

export interface AppPersistenceEnv {
  DB_HOST?: string;
  DB_PORT?: string;
  DB_USER?: string;
  DB_PASS?: string;
  DB_NAME?: string;
  NODE_ENV?: string;
  AGENT_SERVER_ENABLE_DATABASE_IN_TEST?: string;
}

export function shouldEnablePersistence(env: AppPersistenceEnv = process.env): boolean {
  return env.NODE_ENV !== 'test' || env.AGENT_SERVER_ENABLE_DATABASE_IN_TEST === 'true';
}

export function createPersistenceImports(env: AppPersistenceEnv = process.env): PersistenceImport[] {
  if (!shouldEnablePersistence(env)) {
    return [];
  }

  return [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: env.DB_HOST ?? 'localhost',
      port: parseInt(env.DB_PORT ?? '5432', 10),
      username: env.DB_USER ?? 'postgres',
      password: env.DB_PASS ?? 'postgres',
      database: env.DB_NAME ?? 'agent_db',
      entities: [WorkflowRun],
      synchronize: env.NODE_ENV !== 'production'
    }),
    WorkflowRunsModule
  ];
}
