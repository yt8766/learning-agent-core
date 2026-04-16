import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function createTempWorkspace(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `${prefix}-`));
}

export async function cleanupTempWorkspaces(workspaces: readonly string[]): Promise<void> {
  await Promise.all(workspaces.map(workspace => rm(workspace, { recursive: true, force: true })));
}
