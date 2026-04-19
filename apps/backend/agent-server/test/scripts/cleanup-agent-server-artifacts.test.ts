import path from 'node:path';

import fs from 'fs-extra';

const FIXED_NOW = Date.UTC(2026, 3, 19, 0, 0, 0);
const TEST_TMP_ROOT = path.join(process.cwd(), 'tmp');

async function createTempRoot(name: string): Promise<string> {
  const tempRoot = path.join(TEST_TMP_ROOT, name);

  await fs.remove(tempRoot);
  await fs.ensureDir(tempRoot);

  return tempRoot;
}

describe('cleanup-agent-server-artifacts', () => {
  it('reports expired app logs and legacy data in dry-run mode', async () => {
    const tempRoot = await createTempRoot('cleanup-agent-server-artifacts-dry-run');
    const logsDir = path.join(tempRoot, 'logs');
    const dataDir = path.join(tempRoot, 'data');
    const oldLog = path.join(logsDir, 'performance-2026-03-26.log');
    const freshLog = path.join(logsDir, 'error-2026-04-19.log');
    const oldArtifact = path.join(dataDir, 'runtime', 'artifact.json');

    await fs.ensureDir(path.dirname(oldLog));
    await fs.ensureDir(path.dirname(oldArtifact));
    await fs.writeFile(oldLog, 'old log', 'utf8');
    await fs.writeFile(freshLog, 'fresh log', 'utf8');
    await fs.writeFile(oldArtifact, '{}', 'utf8');
    await fs.utimes(oldLog, new Date('2026-03-26T00:00:00.000Z'), new Date('2026-03-26T00:00:00.000Z'));
    await fs.utimes(oldArtifact, new Date('2026-03-26T00:00:00.000Z'), new Date('2026-03-26T00:00:00.000Z'));

    const { runCleanup } = await import('../../scripts/cleanup-agent-server-artifacts.mjs');
    const summary = await runCleanup(['--dry-run', '--retention-days=14'], FIXED_NOW, tempRoot);

    expect(summary).toContain('would remove 2 expired entries');
    expect(summary).toContain(oldLog);
    expect(summary).toContain(oldArtifact);
    expect(await fs.pathExists(oldLog)).toBe(true);
    expect(await fs.pathExists(oldArtifact)).toBe(true);
    expect(await fs.pathExists(freshLog)).toBe(true);

    await fs.remove(tempRoot);
  });

  it('deletes expired entries in live mode', async () => {
    const tempRoot = await createTempRoot('cleanup-agent-server-artifacts-live-mode');
    const oldLog = path.join(tempRoot, 'logs', 'warn-2026-03-20.log');

    await fs.ensureDir(path.dirname(oldLog));
    await fs.writeFile(oldLog, 'old log', 'utf8');
    await fs.utimes(oldLog, new Date('2026-03-20T00:00:00.000Z'), new Date('2026-03-20T00:00:00.000Z'));

    const { runCleanup } = await import('../../scripts/cleanup-agent-server-artifacts.mjs');
    const summary = await runCleanup(['--retention-days=14'], FIXED_NOW, tempRoot);

    expect(summary).toContain('removed 1 expired entries');
    expect(await fs.pathExists(oldLog)).toBe(false);

    await fs.remove(tempRoot);
  });
});
