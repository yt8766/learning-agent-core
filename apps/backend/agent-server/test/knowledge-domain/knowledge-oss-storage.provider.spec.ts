import { describe, expect, it, vi } from 'vitest';

import { InMemoryOssStorageProvider } from '../../src/domains/knowledge/storage/in-memory-oss-storage.provider';
import {
  AliyunOssStorageProvider,
  createKnowledgeOssStorageProvider
} from '../../src/domains/knowledge/storage/knowledge-oss-storage.provider';

describe('createKnowledgeOssStorageProvider', () => {
  it('uses in-memory OSS storage by default', () => {
    const provider = createKnowledgeOssStorageProvider({ env: {} });

    expect(provider.useFactory()).toBeInstanceOf(InMemoryOssStorageProvider);
  });

  it('maps aliyun OSS client operations behind the storage provider contract', async () => {
    const client = {
      put: vi.fn(async () => ({ name: 'knowledge/kb_1/run book.md', url: 'https://sdk.local/object' })),
      get: vi.fn(async () => ({
        content: Buffer.from('hello'),
        res: { headers: { 'content-type': 'text/markdown', 'x-oss-meta-filename': 'runbook.md' } }
      })),
      delete: vi.fn(async () => undefined),
      list: vi.fn(async () => ({
        objects: [{ name: 'knowledge/kb_1/run book.md', size: 5, lastModified: '2026-05-07T00:00:00.000Z' }],
        isTruncated: false
      }))
    };
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'ak',
      accessKeySecret: 'sk',
      bucket: 'bucket',
      client,
      publicBaseUrl: 'https://cdn.example.com/base/'
    });

    await expect(
      provider.putObject({
        objectKey: 'knowledge/kb_1/run book.md',
        body: Buffer.from('hello'),
        contentType: 'text/markdown',
        metadata: { filename: '运行手册.md' }
      })
    ).resolves.toEqual({
      objectKey: 'knowledge/kb_1/run book.md',
      ossUrl: 'https://cdn.example.com/base/knowledge/kb_1/run%20book.md'
    });
    await expect(provider.getObject('knowledge/kb_1/run book.md')).resolves.toMatchObject({
      objectKey: 'knowledge/kb_1/run book.md',
      body: Buffer.from('hello'),
      contentType: 'text/markdown',
      metadata: { filename: 'runbook.md' }
    });
    await expect(provider.listObjects({ prefix: 'knowledge/kb_1', maxKeys: 10 })).resolves.toEqual({
      items: [
        {
          objectKey: 'knowledge/kb_1/run book.md',
          size: 5,
          lastModified: '2026-05-07T00:00:00.000Z'
        }
      ],
      isTruncated: false,
      nextMarker: undefined
    });
    await expect(provider.deleteObject('knowledge/kb_1/run book.md')).resolves.toBeUndefined();

    expect(client.put).toHaveBeenCalledWith(
      'knowledge/kb_1/run book.md',
      Buffer.from('hello'),
      expect.objectContaining({
        meta: { filename: encodeURIComponent('运行手册.md') }
      })
    );
  });
});
