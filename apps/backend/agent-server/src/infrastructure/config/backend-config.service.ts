import { Injectable } from '@nestjs/common';

import { parseBackendEnv, type BackendEnv, type BackendPersistenceMode } from './backend-env.schema';

@Injectable()
export class BackendConfigService {
  private readonly env: BackendEnv;

  constructor(source: NodeJS.ProcessEnv = process.env) {
    this.env = parseBackendEnv(source);
  }

  get persistenceMode(): BackendPersistenceMode {
    return this.env.BACKEND_PERSISTENCE ?? 'memory';
  }

  get databaseUrl(): string | undefined {
    return this.env.DATABASE_URL;
  }

  get databaseHost(): string | undefined {
    return this.env.DB_HOST;
  }

  get legacyRoutesEnabled(): boolean {
    return this.env.BACKEND_ENABLE_LEGACY_ROUTES !== 'false';
  }

  get remoteSkillInstallEnabled(): boolean {
    return this.env.BACKEND_REMOTE_SKILL_INSTALL_ENABLED === 'true';
  }
}
