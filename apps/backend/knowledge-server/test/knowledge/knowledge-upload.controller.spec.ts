import { describe, expect, it } from 'vitest';

import { KnowledgeController } from '../../src/knowledge/knowledge.controller';
import { KnowledgeService } from '../../src/knowledge/knowledge.service';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';
import { InMemoryOssStorageProvider } from '../../src/knowledge/storage/in-memory-oss-storage.provider';
import { KnowledgeUploadService } from '../../src/knowledge/knowledge-upload.service';

const actor = { userId: 'user_1', username: 'dev', roles: ['user'] };

describe('Knowledge upload controller', () => {
  it('uploads markdown and text files through the storage provider', async () => {
    const { controller, storage, baseId } = await createController();

    const markdown = await controller.uploadKnowledgeFile(
      actor,
      baseId,
      createFile('runbook.md', '# Hello', 'text/markdown')
    );
    const text = await controller.uploadKnowledgeFile(
      actor,
      baseId,
      createFile('notes.txt', 'plain notes', 'text/plain')
    );

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
    const { controller, storage, baseId } = await createController();

    await expect(
      controller.uploadKnowledgeFile(actor, baseId, createFile('payload.pdf', '%PDF', 'application/pdf'))
    ).rejects.toMatchObject({
      code: 'knowledge_upload_invalid_type'
    });
    expect(storage.keys()).toEqual([]);
  });

  it('repairs utf-8 filenames decoded as latin1 by multipart parsing', async () => {
    const { controller, baseId } = await createController();

    const upload = await controller.uploadKnowledgeFile(
      actor,
      baseId,
      createFile('04. coreåè®¾è®¡ææ¡£.md', '# Core', 'text/markdown')
    );

    expect(upload.filename).toBe('04. core包设计文档.md');
    expect(upload.objectKey).toContain('04._core');
    expect(upload.objectKey).toContain('.md');
    expect(upload.objectKey).not.toContain('å');
  });
});

async function createController() {
  const repository = new InMemoryKnowledgeRepository();
  const storage = new InMemoryOssStorageProvider();
  const knowledge = new KnowledgeService(repository);
  const upload = new KnowledgeUploadService(repository, storage);
  const controller = new KnowledgeController(knowledge, upload);
  const base = await knowledge.createBase(actor, { name: 'Engineering KB', description: '' });
  return { controller, storage, baseId: base.id };
}

function createFile(originalname: string, content: string, mimetype: string) {
  return {
    originalname,
    mimetype,
    size: Buffer.byteLength(content),
    buffer: Buffer.from(content)
  };
}
