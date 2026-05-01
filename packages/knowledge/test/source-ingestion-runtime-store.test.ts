import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';
import type { KnowledgeVectorDocumentRecord } from '@agent/memory';

import { ingestKnowledgeSourcePayloads, KNOWLEDGE_RELATIVE_PATHS } from '../src';

describe('ingestKnowledgeSourcePayloads', () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.map(root => rm(root, { recursive: true, force: true })));
  });

  it('persists source/chunk/receipt snapshot records and writes vectors through the injected boundary', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'knowledge-source-ingestion-'));
    roots.push(workspaceRoot);
    const vectorRecords: KnowledgeVectorDocumentRecord[] = [];

    const result = await ingestKnowledgeSourcePayloads(
      {
        workspaceRoot,
        knowledgeRoot: join(workspaceRoot, 'knowledge')
      },
      [
        {
          sourceId: 'upload-1',
          sourceType: 'user-upload',
          uri: '/uploads/policy.md',
          title: 'Uploaded Policy',
          trustClass: 'internal',
          content: 'uploaded policy for runtime approval',
          metadata: {
            docType: 'uploaded-policy',
            status: 'active',
            allowedRoles: ['admin']
          }
        }
      ],
      {
        async upsertKnowledge(record) {
          vectorRecords.push(record);
        }
      }
    );

    expect(result).toMatchObject({
      sourceCount: 1,
      indexedDocumentCount: 1,
      chunkCount: 1,
      embeddedChunkCount: 1,
      fulltextChunkCount: 1
    });
    expect(vectorRecords).toHaveLength(1);
    expect(vectorRecords[0]).toEqual(
      expect.objectContaining({
        sourceId: 'upload-1',
        sourceType: 'user-upload',
        title: 'Uploaded Policy'
      })
    );

    const sources = await readJson(join(workspaceRoot, 'knowledge', KNOWLEDGE_RELATIVE_PATHS.sources));
    const chunks = await readJson(join(workspaceRoot, 'knowledge', KNOWLEDGE_RELATIVE_PATHS.chunks));
    const receipts = await readJson(join(workspaceRoot, 'knowledge', KNOWLEDGE_RELATIVE_PATHS.receipts));

    expect(sources).toEqual([
      expect.objectContaining({
        id: 'upload-1',
        store: 'cangjing',
        sourceType: 'user-upload',
        uri: '/uploads/policy.md',
        title: 'Uploaded Policy',
        trustClass: 'internal'
      })
    ]);
    expect(chunks).toEqual([
      expect.objectContaining({
        store: 'cangjing',
        sourceId: 'upload-1',
        searchable: true,
        metadata: expect.objectContaining({
          docType: 'uploaded-policy',
          allowedRoles: ['admin']
        })
      })
    ]);
    expect(receipts).toEqual([
      expect.objectContaining({
        store: 'cangjing',
        sourceId: 'upload-1',
        sourceType: 'user-upload',
        status: 'completed',
        documentCount: 1,
        chunkCount: 1,
        embeddedChunkCount: 1
      })
    ]);
  });
});

async function readJson(path: string) {
  return JSON.parse(await readFile(path, 'utf8')) as unknown[];
}
