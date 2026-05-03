import { describe, expect, it, vi } from 'vitest';

import {
  AliyunOssStorageProvider,
  createAliyunOssStorageProviderFromEnv,
  describeAliyunOssEnv
} from '../../src/knowledge/storage/aliyun-oss-storage.provider';

type MockAliOssClient = NonNullable<ConstructorParameters<typeof AliyunOssStorageProvider>[0]['client']>;

describe('AliyunOssStorageProvider', () => {
  it('uploads objects through ali-oss with project-owned headers and metadata', async () => {
    const client = createClient();
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'access-key',
      accessKeySecret: 'secret',
      bucket: 'agent-kb',
      client,
      region: 'oss-cn-hangzhou',
      publicBaseUrl: 'https://cdn.example.com'
    });

    const result = await provider.putObject({
      objectKey: 'knowledge/kb_1/upload_1/runbook.md',
      body: Buffer.from('# Runbook'),
      contentType: 'text/markdown',
      metadata: {
        knowledgeBaseId: 'kb_1',
        uploadId: 'upload_1'
      }
    });

    expect(result).toEqual({
      objectKey: 'knowledge/kb_1/upload_1/runbook.md',
      ossUrl: 'https://cdn.example.com/knowledge/kb_1/upload_1/runbook.md'
    });
    expect(client.put).toHaveBeenCalledWith('knowledge/kb_1/upload_1/runbook.md', Buffer.from('# Runbook'), {
      headers: {
        'Content-Disposition': 'attachment',
        'Content-Type': 'text/markdown',
        'x-oss-forbid-overwrite': 'true',
        'x-oss-object-acl': 'private',
        'x-oss-storage-class': 'Standard'
      },
      meta: {
        knowledgeBaseId: 'kb_1',
        uploadId: 'upload_1'
      }
    });
  });

  it('encodes non-ASCII OSS metadata values before they become HTTP headers', async () => {
    const client = createClient();
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'access-key',
      accessKeySecret: 'secret',
      bucket: 'agent-kb',
      client,
      region: 'oss-cn-hangzhou'
    });

    await provider.putObject({
      objectKey: 'knowledge/kb_1/upload_1/04._core_____.md',
      body: Buffer.from('# Runbook'),
      contentType: 'text/markdown',
      metadata: {
        filename: '04. core包设计文档.md',
        uploadId: 'upload_1'
      }
    });

    expect(client.put).toHaveBeenCalledWith(
      'knowledge/kb_1/upload_1/04._core_____.md',
      Buffer.from('# Runbook'),
      expect.objectContaining({
        meta: {
          filename: '04.%20core%E5%8C%85%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3.md',
          uploadId: 'upload_1'
        }
      })
    );
  });

  it('downloads objects through ali-oss and normalizes metadata', async () => {
    const client = createClient({
      get: vi.fn().mockResolvedValue({
        content: Buffer.from('# Runbook'),
        res: {
          headers: {
            'content-type': 'text/markdown',
            'x-oss-meta-knowledgebaseid': 'kb_1',
            'x-oss-meta-uploadid': 'upload_1'
          }
        }
      })
    });
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'access-key',
      accessKeySecret: 'secret',
      bucket: 'agent-kb',
      client,
      region: 'oss-cn-hangzhou'
    });

    await expect(provider.getObject('knowledge/kb_1/upload_1/runbook.md')).resolves.toEqual({
      objectKey: 'knowledge/kb_1/upload_1/runbook.md',
      body: Buffer.from('# Runbook'),
      contentType: 'text/markdown',
      metadata: {
        knowledgebaseid: 'kb_1',
        uploadid: 'upload_1'
      }
    });
    expect(client.get).toHaveBeenCalledWith('knowledge/kb_1/upload_1/runbook.md');
  });

  it('returns undefined for missing downloads and treats missing deletes as idempotent', async () => {
    const client = createClient({
      delete: vi.fn().mockRejectedValue({ code: 'NoSuchKey' }),
      get: vi.fn().mockRejectedValue({ status: 404 })
    });
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'access-key',
      accessKeySecret: 'secret',
      bucket: 'agent-kb',
      client,
      region: 'oss-cn-hangzhou'
    });

    await expect(provider.getObject('knowledge/missing.md')).resolves.toBeUndefined();
    await expect(provider.deleteObject('knowledge/missing.md')).resolves.toBeUndefined();
  });

  it('wraps ali-oss failures in project-owned errors without raw SDK objects', async () => {
    const client = createClient({
      get: vi.fn().mockRejectedValue({ code: 'AccessDenied', requestId: 'req_1', status: 403 })
    });
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'access-key',
      accessKeySecret: 'secret',
      bucket: 'agent-kb',
      client,
      region: 'oss-cn-hangzhou'
    });

    await expect(provider.getObject('knowledge/broken.md')).rejects.toMatchObject({
      code: 'knowledge_upload_oss_failed',
      message: 'OSS 读取失败：HTTP 403 AccessDenied requestId=req_1'
    });
  });

  it('keeps ali-oss network error messages visible for diagnosis', async () => {
    const client = createClient({
      put: vi.fn().mockRejectedValue({ code: 'TypeError', message: 'fetch failed', status: -1 })
    });
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'access-key',
      accessKeySecret: 'secret',
      bucket: 'agent-kb',
      client,
      region: 'oss-cn-hangzhou'
    });

    await expect(
      provider.putObject({
        objectKey: 'knowledge/broken.md',
        body: Buffer.from('broken'),
        contentType: 'text/markdown'
      })
    ).rejects.toMatchObject({
      code: 'knowledge_upload_oss_failed',
      message: 'OSS 上传失败：HTTP -1 TypeError fetch failed'
    });
  });

  it('deletes and lists objects through ali-oss without leaking SDK shapes', async () => {
    const client = createClient({
      list: vi.fn().mockResolvedValue({
        objects: [
          {
            name: 'knowledge/kb_1/upload_1/runbook.md',
            size: 9,
            lastModified: '2026-05-02T00:00:00.000Z'
          }
        ],
        nextMarker: 'next',
        isTruncated: true
      })
    });
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'access-key',
      accessKeySecret: 'secret',
      bucket: 'agent-kb',
      client,
      region: 'oss-cn-hangzhou'
    });

    await provider.deleteObject('knowledge/kb_1/upload_1/runbook.md');
    const listed = await provider.listObjects({ prefix: 'knowledge/kb_1/', marker: 'start', maxKeys: 10 });

    expect(client.delete).toHaveBeenCalledWith('knowledge/kb_1/upload_1/runbook.md');
    expect(client.list).toHaveBeenCalledWith({
      marker: 'start',
      'max-keys': 10,
      prefix: 'knowledge/kb_1/'
    });
    expect(listed).toEqual({
      items: [
        {
          objectKey: 'knowledge/kb_1/upload_1/runbook.md',
          size: 9,
          lastModified: '2026-05-02T00:00:00.000Z'
        }
      ],
      nextMarker: 'next',
      isTruncated: true
    });
  });

  it('uses memory only when OSS environment variables are entirely absent', () => {
    expect(createAliyunOssStorageProviderFromEnv({})).toBeUndefined();
    expect(createAliyunOssStorageProviderFromEnv({ KNOWLEDGE_OSS_PROVIDER: 'memory' })).toBeUndefined();
    expect(() =>
      createAliyunOssStorageProviderFromEnv({
        KNOWLEDGE_OSS_PROVIDER: 'aliyun',
        ALIYUN_OSS_ACCESS_KEY_ID: 'access-key',
        ALIYUN_OSS_ACCESS_KEY_SECRET: 'secret',
        ALIYUN_OSS_BUCKET: 'agent-kb',
        ALIYUN_OSS_ENDPOINT: 'https://agent-kb.oss-cn-hangzhou.aliyuncs.com'
      })
    ).toThrow('OSS 配置不完整');
    expect(
      createAliyunOssStorageProviderFromEnv({
        KNOWLEDGE_OSS_PROVIDER: 'aliyun',
        ALIYUN_OSS_ACCESS_KEY_ID: 'access-key',
        ALIYUN_OSS_ACCESS_KEY_SECRET: 'secret',
        ALIYUN_OSS_BUCKET: 'agent-kb',
        ALIYUN_OSS_REGION: 'oss-cn-hangzhou'
      })
    ).toBeInstanceOf(AliyunOssStorageProvider);
  });

  it('rejects unknown OSS provider modes', () => {
    expect(() => createAliyunOssStorageProviderFromEnv({ KNOWLEDGE_OSS_PROVIDER: 'local' })).toThrow(
      'KNOWLEDGE_OSS_PROVIDER 只支持 aliyun 或 memory'
    );
  });

  it('describes OSS configuration without leaking credentials', () => {
    expect(
      describeAliyunOssEnv({
        ALIYUN_OSS_ACCESS_KEY_ID: 'access-key',
        ALIYUN_OSS_ACCESS_KEY_SECRET: 'secret',
        ALIYUN_OSS_BUCKET: 'agent-kb',
        ALIYUN_OSS_ENDPOINT: 'https://oss-cn-hangzhou.aliyuncs.com',
        ALIYUN_OSS_REGION: 'oss-cn-hangzhou'
      })
    ).toBe(
      'bucket=set region=oss-cn-hangzhou endpoint=https://oss-cn-hangzhou.aliyuncs.com accessKeyId=set accessKeySecret=set'
    );
  });
});

function createClient(overrides: Partial<MockAliOssClient> = {}): MockAliOssClient {
  return {
    delete: vi.fn<MockAliOssClient['delete']>().mockResolvedValue({}),
    get: vi.fn<MockAliOssClient['get']>().mockResolvedValue({
      content: Buffer.from(''),
      res: { headers: {} }
    }),
    list: vi.fn<MockAliOssClient['list']>().mockResolvedValue({
      objects: [],
      nextMarker: undefined,
      isTruncated: false
    }),
    put: vi.fn<MockAliOssClient['put']>().mockResolvedValue({}),
    ...overrides
  };
}
