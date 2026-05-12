import { describe, expect, it, vi } from 'vitest';

import {
  AliyunOssStorageProvider,
  createKnowledgeOssStorageProvider,
  createAliyunOssStorageProviderFromEnv
} from '../../src/domains/knowledge/storage/knowledge-oss-storage.provider';
import { InMemoryOssStorageProvider } from '../../src/domains/knowledge/storage/in-memory-oss-storage.provider';
import { KnowledgeServiceError } from '../../src/domains/knowledge/services/knowledge-service.error';

function createMockAliOssClient() {
  return {
    put: vi.fn().mockResolvedValue({ name: 'test.txt', url: 'https://oss.example.com/test.txt' }),
    get: vi.fn().mockResolvedValue({
      content: Buffer.from('hello'),
      res: { headers: { 'content-type': 'text/plain', 'x-oss-meta-source': 'test' } }
    }),
    delete: vi.fn().mockResolvedValue({}),
    list: vi.fn().mockResolvedValue({
      objects: [{ name: 'test.txt', size: 5, lastModified: '2026-05-01T00:00:00.000Z' }],
      isTruncated: false
    })
  };
}

describe('AliyunOssStorageProvider', () => {
  it('throws when no region and no client provided', () => {
    expect(
      () =>
        new AliyunOssStorageProvider({
          accessKeyId: 'key',
          accessKeySecret: 'secret',
          bucket: 'test-bucket'
        })
    ).toThrow(KnowledgeServiceError);
  });

  it('putObject stores and returns ossUrl', async () => {
    const client = createMockAliOssClient();
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'key',
      accessKeySecret: 'secret',
      bucket: 'test-bucket',
      region: 'oss-cn-hangzhou',
      client: client as never
    });

    const result = await provider.putObject({
      objectKey: 'docs/test.txt',
      body: 'hello',
      contentType: 'text/plain',
      metadata: { source: 'test' }
    });

    expect(result.objectKey).toBe('docs/test.txt');
    expect(client.put).toHaveBeenCalled();
  });

  it('putObject with publicBaseUrl returns public URL', async () => {
    const client = createMockAliOssClient();
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'key',
      accessKeySecret: 'secret',
      bucket: 'test-bucket',
      region: 'oss-cn-hangzhou',
      publicBaseUrl: 'https://cdn.example.com/',
      client: client as never
    });

    const result = await provider.putObject({
      objectKey: 'docs/test.txt',
      body: 'hello',
      contentType: 'text/plain'
    });

    expect(result.ossUrl).toBe('https://cdn.example.com/docs/test.txt');
  });

  it('putObject throws KnowledgeServiceError on failure', async () => {
    const client = createMockAliOssClient();
    client.put.mockRejectedValue(new Error('upload failed'));
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'key',
      accessKeySecret: 'secret',
      bucket: 'test-bucket',
      region: 'oss-cn-hangzhou',
      client: client as never
    });

    await expect(provider.putObject({ objectKey: 'test.txt', body: 'hello' })).rejects.toThrow(KnowledgeServiceError);
  });

  it('getObject returns stored object', async () => {
    const client = createMockAliOssClient();
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'key',
      accessKeySecret: 'secret',
      bucket: 'test-bucket',
      region: 'oss-cn-hangzhou',
      client: client as never
    });

    const result = await provider.getObject('test.txt');

    expect(result).toBeDefined();
    expect(result!.objectKey).toBe('test.txt');
    expect(result!.body.toString()).toBe('hello');
    expect(result!.contentType).toBe('text/plain');
    expect(result!.metadata).toEqual({ source: 'test' });
  });

  it('getObject returns undefined for 404 errors', async () => {
    const client = createMockAliOssClient();
    client.get.mockRejectedValue({ status: 404 });
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'key',
      accessKeySecret: 'secret',
      bucket: 'test-bucket',
      region: 'oss-cn-hangzhou',
      client: client as never
    });

    const result = await provider.getObject('missing');

    expect(result).toBeUndefined();
  });

  it('getObject throws for non-404 errors', async () => {
    const client = createMockAliOssClient();
    client.get.mockRejectedValue({ status: 500, message: 'server error' });
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'key',
      accessKeySecret: 'secret',
      bucket: 'test-bucket',
      region: 'oss-cn-hangzhou',
      client: client as never
    });

    await expect(provider.getObject('test.txt')).rejects.toThrow(KnowledgeServiceError);
  });

  it('deleteObject deletes successfully', async () => {
    const client = createMockAliOssClient();
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'key',
      accessKeySecret: 'secret',
      bucket: 'test-bucket',
      region: 'oss-cn-hangzhou',
      client: client as never
    });

    await provider.deleteObject('test.txt');

    expect(client.delete).toHaveBeenCalledWith('test.txt');
  });

  it('deleteObject ignores 404 errors', async () => {
    const client = createMockAliOssClient();
    client.delete.mockRejectedValue({ status: 404 });
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'key',
      accessKeySecret: 'secret',
      bucket: 'test-bucket',
      region: 'oss-cn-hangzhou',
      client: client as never
    });

    await expect(provider.deleteObject('missing')).resolves.toBeUndefined();
  });

  it('deleteObject throws for non-404 errors', async () => {
    const client = createMockAliOssClient();
    client.delete.mockRejectedValue({ status: 500, message: 'server error' });
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'key',
      accessKeySecret: 'secret',
      bucket: 'test-bucket',
      region: 'oss-cn-hangzhou',
      client: client as never
    });

    await expect(provider.deleteObject('test.txt')).rejects.toThrow(KnowledgeServiceError);
  });

  it('listObjects returns objects', async () => {
    const client = createMockAliOssClient();
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'key',
      accessKeySecret: 'secret',
      bucket: 'test-bucket',
      region: 'oss-cn-hangzhou',
      client: client as never
    });

    const result = await provider.listObjects({ prefix: 'docs/' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].objectKey).toBe('test.txt');
  });

  it('listObjects throws on error', async () => {
    const client = createMockAliOssClient();
    client.list.mockRejectedValue({ status: 500, message: 'server error' });
    const provider = new AliyunOssStorageProvider({
      accessKeyId: 'key',
      accessKeySecret: 'secret',
      bucket: 'test-bucket',
      region: 'oss-cn-hangzhou',
      client: client as never
    });

    await expect(provider.listObjects()).rejects.toThrow(KnowledgeServiceError);
  });
});

describe('createKnowledgeOssStorageProvider', () => {
  it('returns InMemoryOssStorageProvider when no env vars set', () => {
    const provider = createKnowledgeOssStorageProvider({ env: {} });

    expect(provider.provide).toBeDefined();
    expect(provider.useFactory()).toBeInstanceOf(InMemoryOssStorageProvider);
  });

  it('returns InMemoryOssStorageProvider when provider is memory', () => {
    const provider = createKnowledgeOssStorageProvider({
      env: { KNOWLEDGE_OSS_PROVIDER: 'memory' }
    });

    expect(provider.useFactory()).toBeInstanceOf(InMemoryOssStorageProvider);
  });
});

describe('createAliyunOssStorageProviderFromEnv', () => {
  it('returns undefined when no env vars set', () => {
    expect(createAliyunOssStorageProviderFromEnv({})).toBeUndefined();
  });

  it('returns undefined when provider is memory', () => {
    expect(createAliyunOssStorageProviderFromEnv({ KNOWLEDGE_OSS_PROVIDER: 'memory' })).toBeUndefined();
  });

  it('throws when provider is invalid', () => {
    expect(() => createAliyunOssStorageProviderFromEnv({ KNOWLEDGE_OSS_PROVIDER: 'aws' })).toThrow(
      KnowledgeServiceError
    );
  });

  it('throws when required env vars are missing', () => {
    expect(() =>
      createAliyunOssStorageProviderFromEnv({
        KNOWLEDGE_OSS_PROVIDER: 'aliyun',
        ALIYUN_OSS_BUCKET: 'bucket'
      })
    ).toThrow(KnowledgeServiceError);
  });
});
