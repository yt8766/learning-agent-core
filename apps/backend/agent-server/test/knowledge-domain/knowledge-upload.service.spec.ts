import { describe, expect, it } from 'vitest';

import { KnowledgeMemoryRepository } from '../../src/domains/knowledge/repositories/knowledge-memory.repository';
import { KnowledgeBaseService } from '../../src/domains/knowledge/services/knowledge-base.service';
import { KnowledgeUploadService } from '../../src/domains/knowledge/services/knowledge-upload.service';
import { InMemoryOssStorageProvider } from '../../src/domains/knowledge/storage/in-memory-oss-storage.provider';

const actor = { userId: 'user_1' };

describe('KnowledgeUploadService', () => {
  it('uploads markdown and text files through the storage provider', async () => {
    const { upload, storage, baseId } = await createUploadService();

    const markdown = await upload.uploadFile(actor, baseId, createFile('runbook.md', '# Hello', 'text/markdown'));
    const text = await upload.uploadFile(actor, baseId, createFile('notes.txt', 'plain notes', 'text/plain'));

    expect(markdown).toMatchObject({
      knowledgeBaseId: baseId,
      filename: 'runbook.md',
      contentType: 'text/markdown'
    });
    expect(markdown.objectKey).toContain(`knowledge/${baseId}/`);
    expect(markdown.ossUrl).toBe(`oss://memory/${markdown.objectKey}`);
    await expect(storage.getObject(markdown.objectKey)).resolves.toMatchObject({
      body: Buffer.from('# Hello')
    });

    expect(text).toMatchObject({
      knowledgeBaseId: baseId,
      filename: 'notes.txt',
      contentType: 'text/plain'
    });
  });

  it('rejects unsupported upload types before writing storage', async () => {
    const { upload, storage, baseId } = await createUploadService();

    await expect(
      upload.uploadFile(actor, baseId, createFile('payload.pdf', '%PDF', 'application/pdf'))
    ).rejects.toMatchObject({
      code: 'knowledge_upload_invalid_type'
    });
    expect(storage.keys()).toEqual([]);
  });

  it('repairs utf-8 filenames decoded as latin1 by multipart parsing', async () => {
    const { upload, baseId } = await createUploadService();

    const result = await upload.uploadFile(
      actor,
      baseId,
      createFile('04. coreåè®¾è®¡ææ¡£.md', '# Core', 'text/markdown')
    );

    expect(result.filename).toBe('04. core包设计文档.md');
    expect(result.objectKey).toContain('04._core');
    expect(result.objectKey).toContain('.md');
    expect(result.objectKey).not.toContain('å');
  });
});

async function createUploadService() {
  const repository = new KnowledgeMemoryRepository();
  const storage = new InMemoryOssStorageProvider();
  const baseService = new KnowledgeBaseService(repository);
  const upload = new KnowledgeUploadService(repository, storage);
  const base = await baseService.createBase(actor, { name: 'Engineering KB', description: '' });

  return { upload, storage, baseId: base.id };
}

function createFile(originalname: string, content: string, mimetype: string) {
  return {
    originalname,
    mimetype,
    size: Buffer.byteLength(content),
    buffer: Buffer.from(content)
  };
}
