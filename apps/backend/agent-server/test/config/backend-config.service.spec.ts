import { describe, expect, it } from 'vitest';

import { BackendConfigService } from '../../src/infrastructure/config/backend-config.service';

describe('BackendConfigService', () => {
  it('returns default persistence mode as memory when not set', () => {
    const service = new BackendConfigService({});

    expect(service.persistenceMode).toBe('memory');
  });

  it('returns configured persistence mode', () => {
    const service = new BackendConfigService({ BACKEND_PERSISTENCE: 'postgres' });

    expect(service.persistenceMode).toBe('postgres');
  });

  it('returns databaseUrl when set', () => {
    const service = new BackendConfigService({ DATABASE_URL: 'postgres://localhost/db' });

    expect(service.databaseUrl).toBe('postgres://localhost/db');
  });

  it('returns undefined databaseUrl when not set', () => {
    const service = new BackendConfigService({});

    expect(service.databaseUrl).toBeUndefined();
  });

  it('returns databaseHost when set', () => {
    const service = new BackendConfigService({ DB_HOST: 'localhost' });

    expect(service.databaseHost).toBe('localhost');
  });

  it('returns undefined databaseHost when not set', () => {
    const service = new BackendConfigService({});

    expect(service.databaseHost).toBeUndefined();
  });

  it('returns legacyRoutesEnabled as true by default', () => {
    const service = new BackendConfigService({});

    expect(service.legacyRoutesEnabled).toBe(true);
  });

  it('returns legacyRoutesEnabled as false when explicitly disabled', () => {
    const service = new BackendConfigService({ BACKEND_ENABLE_LEGACY_ROUTES: 'false' });

    expect(service.legacyRoutesEnabled).toBe(false);
  });

  it('returns remoteSkillInstallEnabled as false by default', () => {
    const service = new BackendConfigService({});

    expect(service.remoteSkillInstallEnabled).toBe(false);
  });

  it('returns remoteSkillInstallEnabled as true when enabled', () => {
    const service = new BackendConfigService({ BACKEND_REMOTE_SKILL_INSTALL_ENABLED: 'true' });

    expect(service.remoteSkillInstallEnabled).toBe(true);
  });
});
