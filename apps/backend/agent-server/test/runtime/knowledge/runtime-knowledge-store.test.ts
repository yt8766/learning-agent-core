import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { loadSettings } from '@agent/config';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ingestLocalKnowledge,
  listKnowledgeArtifacts,
  readKnowledgeOverview
} from '../../../src/runtime/knowledge/runtime-knowledge-store';

const tempRoots: string[] = [];

describe('runtime-knowledge-store', () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map(async root => {
        const { rm } = await import('node:fs/promises');
        await rm(root, { recursive: true, force: true });
      })
    );
  });

  it('persists local sources, chunks, and failed embedding receipts when glm embedding is unavailable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'knowledge-store-'));
    tempRoots.push(root);
    await mkdir(join(root, 'docs'), { recursive: true });
    await mkdir(join(root, 'apps/backend/agent-server'), { recursive: true });
    await writeFile(join(root, 'README.md'), '# Root\n\nhello knowledge');
    await writeFile(join(root, 'PROJECT_CONVENTIONS.md'), '# Conventions\n\nkeep it canonical');
    await writeFile(join(root, 'docs', 'ARCHITECTURE.md'), '# Architecture\n\nfive layers');
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'fixture' }, null, 2));
    await writeFile(join(root, 'apps/backend/agent-server/package.json'), JSON.stringify({ name: 'server' }, null, 2));

    const settings = loadSettings({
      workspaceRoot: root,
      overrides: {
        zhipuApiKey: '',
        knowledgeRoot: 'data/knowledge'
      }
    });

    const overview = await ingestLocalKnowledge(settings);
    const stored = await listKnowledgeArtifacts(settings);
    const reloaded = await readKnowledgeOverview(settings);

    expect(overview.stores.map(item => item.store)).toEqual(expect.arrayContaining(['wenyuan', 'cangjing']));
    expect(stored.sources.length).toBeGreaterThan(0);
    expect(stored.chunks.length).toBeGreaterThan(0);
    expect(stored.embeddings.every(item => item.embeddingProvider === 'glm')).toBe(true);
    expect(stored.embeddings.every(item => item.embeddingModel === 'Embedding-3')).toBe(true);
    expect(stored.embeddings.some(item => item.status === 'failed')).toBe(true);
    expect(stored.receipts.length).toBeGreaterThan(0);
    expect(reloaded.blockedDocumentCount).toBeGreaterThan(0);
  });
});
