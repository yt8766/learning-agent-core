import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { publishPluginDraft, type PluginDraft } from '../../src/install/plugin-draft-publisher';

let tmpDir: string;

function makeDraft(overrides: Partial<PluginDraft> = {}): PluginDraft {
  return {
    id: 'draft-001',
    name: 'Test Plugin',
    description: 'A test plugin draft',
    manifest: { version: '1.0', tools: [] },
    status: 'draft',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'plugin-draft-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('publishPluginDraft', () => {
  it('writes the draft to plugins-lab/<id>.json', async () => {
    const draft = makeDraft();
    const result = await publishPluginDraft(tmpDir, draft);

    expect(result).toEqual(draft);

    const raw = await readFile(join(tmpDir, 'plugins-lab', 'draft-001.json'), 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.id).toBe('draft-001');
    expect(parsed.name).toBe('Test Plugin');
  });

  it('creates the plugins-lab directory if it does not exist', async () => {
    const draft = makeDraft({ id: 'nested-draft' });
    await publishPluginDraft(tmpDir, draft);

    const raw = await readFile(join(tmpDir, 'plugins-lab', 'nested-draft.json'), 'utf8');
    expect(JSON.parse(raw).id).toBe('nested-draft');
  });

  it('preserves all draft fields including code and manifest', async () => {
    const draft = makeDraft({
      code: 'console.log("hello")',
      manifest: { tools: ['tool-a'], config: { key: 'value' } }
    });
    await publishPluginDraft(tmpDir, draft);

    const raw = await readFile(join(tmpDir, 'plugins-lab', 'draft-001.json'), 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.code).toBe('console.log("hello")');
    expect(parsed.manifest.tools).toEqual(['tool-a']);
  });

  it('returns the draft object unchanged', async () => {
    const draft = makeDraft();
    const result = await publishPluginDraft(tmpDir, draft);
    expect(result).toBe(draft);
  });

  it('overwrites an existing draft with the same id', async () => {
    const draft1 = makeDraft({ name: 'First Version' });
    const draft2 = makeDraft({ name: 'Updated Version' });

    await publishPluginDraft(tmpDir, draft1);
    await publishPluginDraft(tmpDir, draft2);

    const raw = await readFile(join(tmpDir, 'plugins-lab', 'draft-001.json'), 'utf8');
    expect(JSON.parse(raw).name).toBe('Updated Version');
  });
});
