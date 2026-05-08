import { existsSync, readFileSync } from 'node:fs';

describe('agent-server unified backend composition', () => {
  it('keeps agent-server as the single backend host with internal domain boundaries', () => {
    const appModule = readFileSync(new URL('../../src/app.module.ts', import.meta.url), 'utf8');

    expect(appModule).not.toContain("from '@agent/auth-server'");
    expect(appModule).not.toContain("from '@agent/knowledge-server'");
    expect(appModule).not.toContain('../auth-server/src');
    expect(appModule).not.toContain('../knowledge-server/src');
  });

  it('defines the target unified backend directories before migration work starts', () => {
    const root = new URL('../../src/', import.meta.url);

    expect(existsSync(new URL('app/', root))).toBe(true);
    expect(existsSync(new URL('api/', root))).toBe(true);
    expect(existsSync(new URL('domains/', root))).toBe(true);
    expect(existsSync(new URL('infrastructure/', root))).toBe(true);
    expect(existsSync(new URL('platform/', root))).toBe(true);
    expect(existsSync(new URL('shared/', root))).toBe(true);
  });

  it('treats architecture boundary directories as backend structure roots, not Nest modules', () => {
    const structureCheck = readFileSync(
      new URL('../../../../../scripts/check-backend-structure.js', import.meta.url),
      'utf8'
    );

    expect(structureCheck).toContain("'api', 'app', 'domains', 'infrastructure', 'platform', 'shared'");
  });
});
