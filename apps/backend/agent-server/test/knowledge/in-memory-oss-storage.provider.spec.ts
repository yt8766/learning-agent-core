import { describe, expect, it } from 'vitest';

import { InMemoryOssStorageProvider } from '../../src/domains/knowledge/storage/in-memory-oss-storage.provider';

describe('InMemoryOssStorageProvider', () => {
  it('putObject stores and returns ossUrl', async () => {
    const provider = new InMemoryOssStorageProvider();

    const result = await provider.putObject({
      objectKey: 'docs/test.txt',
      body: 'hello',
      contentType: 'text/plain'
    });

    expect(result.objectKey).toBe('docs/test.txt');
    expect(result.ossUrl).toBe('oss://memory/docs/test.txt');
  });

  it('getObject returns stored object', async () => {
    const provider = new InMemoryOssStorageProvider();

    await provider.putObject({
      objectKey: 'docs/test.txt',
      body: 'hello world',
      contentType: 'text/plain',
      metadata: { source: 'test' }
    });

    const obj = await provider.getObject('docs/test.txt');

    expect(obj).toBeDefined();
    expect(obj!.objectKey).toBe('docs/test.txt');
    expect(obj!.body.toString()).toBe('hello world');
    expect(obj!.contentType).toBe('text/plain');
    expect(obj!.metadata).toEqual({ source: 'test' });
  });

  it('getObject returns undefined for missing key', async () => {
    const provider = new InMemoryOssStorageProvider();

    const obj = await provider.getObject('missing');

    expect(obj).toBeUndefined();
  });

  it('deleteObject removes stored object', async () => {
    const provider = new InMemoryOssStorageProvider();

    await provider.putObject({ objectKey: 'key1', body: 'data' });
    await provider.deleteObject('key1');

    expect(await provider.getObject('key1')).toBeUndefined();
  });

  it('listObjects returns all objects when no filter', async () => {
    const provider = new InMemoryOssStorageProvider();

    await provider.putObject({ objectKey: 'a.txt', body: '1' });
    await provider.putObject({ objectKey: 'b.txt', body: '2' });

    const result = await provider.listObjects();

    expect(result.items).toHaveLength(2);
    expect(result.isTruncated).toBe(false);
  });

  it('listObjects filters by prefix', async () => {
    const provider = new InMemoryOssStorageProvider();

    await provider.putObject({ objectKey: 'docs/a.txt', body: '1' });
    await provider.putObject({ objectKey: 'docs/b.txt', body: '2' });
    await provider.putObject({ objectKey: 'other/c.txt', body: '3' });

    const result = await provider.listObjects({ prefix: 'docs/' });

    expect(result.items).toHaveLength(2);
  });

  it('listObjects filters by marker', async () => {
    const provider = new InMemoryOssStorageProvider();

    await provider.putObject({ objectKey: 'a.txt', body: '1' });
    await provider.putObject({ objectKey: 'b.txt', body: '2' });
    await provider.putObject({ objectKey: 'c.txt', body: '3' });

    const result = await provider.listObjects({ marker: 'a.txt' });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].objectKey).toBe('b.txt');
  });

  it('listObjects respects maxKeys', async () => {
    const provider = new InMemoryOssStorageProvider();

    await provider.putObject({ objectKey: 'a.txt', body: '1' });
    await provider.putObject({ objectKey: 'b.txt', body: '2' });
    await provider.putObject({ objectKey: 'c.txt', body: '3' });

    const result = await provider.listObjects({ maxKeys: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.isTruncated).toBe(true);
    expect(result.nextMarker).toBe('b.txt');
  });

  it('keys returns all stored keys', async () => {
    const provider = new InMemoryOssStorageProvider();

    await provider.putObject({ objectKey: 'x.txt', body: '1' });
    await provider.putObject({ objectKey: 'y.txt', body: '2' });

    expect(provider.keys()).toEqual(expect.arrayContaining(['x.txt', 'y.txt']));
  });
});
