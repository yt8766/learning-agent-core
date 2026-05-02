import pg from 'pg';

import type { PostgresAuthClient } from '../repositories/auth-postgres.repository';

export interface AuthDatabaseProviderOptions {
  databaseUrl: string;
}

export function createAuthDatabaseClient(options: AuthDatabaseProviderOptions): PostgresAuthClient {
  return new pg.Pool({ connectionString: options.databaseUrl });
}
