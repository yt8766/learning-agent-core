import { describe, expect, it, vi } from 'vitest';

import {
  PostgresKnowledgeRepository,
  type PostgresKnowledgeClient
} from '../../src/domains/knowledge/repositories/knowledge-postgres.repository';

function createMockClient(rows: Array<Record<string, unknown>> = []): PostgresKnowledgeClient {
  return {
    query: vi.fn().mockResolvedValue({ rows })
  };
}

const baseRow = {
  id: 'kb-1',
  name: 'Test Base',
  description: 'A test knowledge base',
  created_by_user_id: 'user-1',
  status: 'active',
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z'
};

const memberRow = {
  knowledge_base_id: 'kb-1',
  user_id: 'user-1',
  role: 'owner',
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z'
};

const uploadRow = {
  upload_id: 'up-1',
  knowledge_base_id: 'kb-1',
  filename: 'test.pdf',
  size_bytes: 1024,
  content_type: 'application/pdf',
  object_key: 'uploads/test.pdf',
  oss_url: 'oss://test/test.pdf',
  uploaded_by_user_id: 'user-1',
  uploaded_at: '2026-05-01T00:00:00.000Z'
};

const documentRow = {
  id: 'doc-1',
  workspace_id: 'default',
  knowledge_base_id: 'kb-1',
  upload_id: 'up-1',
  object_key: 'uploads/test.pdf',
  filename: 'test.pdf',
  title: 'Test',
  source_type: 'user-upload',
  status: 'ready',
  version: 'v1',
  chunk_count: 5,
  embedded_chunk_count: 5,
  created_by: 'user-1',
  metadata: '{}',
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z'
};

const jobRow = {
  id: 'job-1',
  document_id: 'doc-1',
  status: 'completed',
  stage: 'done',
  current_stage: 'done',
  stages: '[]',
  progress: '{}',
  error: null,
  error_code: null,
  error_message: null,
  attempts: 1,
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z'
};

const chunkRow = {
  id: 'chk-1',
  document_id: 'doc-1',
  ordinal: 0,
  content: 'Hello world',
  token_count: 2,
  embedding_status: 'completed',
  vector_index_status: 'completed',
  keyword_index_status: 'completed',
  metadata: '{}',
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z'
};

const conversationRow = {
  id: 'conv-1',
  user_id: 'user-1',
  title: 'Test Conversation',
  active_model_profile_id: 'default',
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z'
};

const messageRow = {
  id: 'msg-1',
  conversation_id: 'conv-1',
  user_id: 'user-1',
  role: 'user',
  content: 'Hello',
  model_profile_id: null,
  trace_id: null,
  citations: '[]',
  route: null,
  diagnostics: null,
  feedback: null,
  created_at: '2026-05-01T00:00:00.000Z'
};

describe('PostgresKnowledgeRepository', () => {
  describe('createBase', () => {
    it('creates a base and returns the mapped record', async () => {
      const client = createMockClient([baseRow, memberRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.createBase({
        name: 'Test Base',
        description: 'A test knowledge base',
        ownerId: 'user-1'
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Base');
    });

    it('throws when ownerId is missing', async () => {
      const client = createMockClient([]);
      const repo = new PostgresKnowledgeRepository(client);

      await expect(repo.createBase({ name: 'Test' })).rejects.toThrow('knowledge_base_owner_required');
    });
  });

  describe('listBases', () => {
    it('returns bases for a user', async () => {
      const client = createMockClient([baseRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.listBases({ userId: 'user-1' });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Base');
    });
  });

  describe('findBase', () => {
    it('returns a base when found', async () => {
      const client = createMockClient([baseRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.findBase('kb-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('kb-1');
    });

    it('returns undefined when not found', async () => {
      const client = createMockClient([]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.findBase('missing');

      expect(result).toBeUndefined();
    });
  });

  describe('addMember', () => {
    it('adds a member and returns the mapped record', async () => {
      const client = createMockClient([memberRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.addMember({
        knowledgeBaseId: 'kb-1',
        userId: 'user-1',
        role: 'owner'
      });

      expect(result.role).toBe('owner');
    });
  });

  describe('findMember', () => {
    it('returns a member when found', async () => {
      const client = createMockClient([memberRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.findMember('kb-1', 'user-1');

      expect(result).toBeDefined();
      expect(result!.role).toBe('owner');
    });

    it('returns undefined when not found', async () => {
      const client = createMockClient([]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.findMember('kb-1', 'missing');

      expect(result).toBeUndefined();
    });
  });

  describe('listMembers', () => {
    it('returns all members for a base', async () => {
      const client = createMockClient([memberRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.listMembers('kb-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('saveUpload', () => {
    it('saves an upload and returns the mapped record', async () => {
      const client = createMockClient([uploadRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.saveUpload({
        uploadId: 'up-1',
        knowledgeBaseId: 'kb-1',
        filename: 'test.pdf',
        size: 1024,
        contentType: 'application/pdf',
        objectKey: 'uploads/test.pdf',
        ossUrl: 'oss://test/test.pdf',
        uploadedByUserId: 'user-1',
        uploadedAt: '2026-05-01T00:00:00.000Z'
      });

      expect(result.uploadId).toBe('up-1');
    });
  });

  describe('findUpload', () => {
    it('returns an upload when found', async () => {
      const client = createMockClient([uploadRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.findUpload('up-1');

      expect(result).toBeDefined();
      expect(result!.uploadId).toBe('up-1');
    });

    it('returns undefined when not found', async () => {
      const client = createMockClient([]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.findUpload('missing');

      expect(result).toBeUndefined();
    });
  });

  describe('createDocument', () => {
    it('creates a document and returns the mapped record', async () => {
      const client = createMockClient([documentRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.createDocument({
        id: 'doc-1',
        workspaceId: 'default',
        knowledgeBaseId: 'kb-1',
        uploadId: 'up-1',
        objectKey: 'uploads/test.pdf',
        filename: 'test.pdf',
        title: 'Test',
        sourceType: 'user-upload',
        status: 'queued',
        version: 'v1',
        chunkCount: 0,
        embeddedChunkCount: 0,
        createdBy: 'user-1',
        metadata: {},
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z'
      });

      expect(result.id).toBe('doc-1');
    });
  });

  describe('updateDocument', () => {
    it('updates a document and returns the mapped record', async () => {
      const client = createMockClient([documentRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.updateDocument({
        id: 'doc-1',
        workspaceId: 'default',
        knowledgeBaseId: 'kb-1',
        uploadId: 'up-1',
        objectKey: 'uploads/test.pdf',
        filename: 'test.pdf',
        title: 'Test',
        sourceType: 'user-upload',
        status: 'ready',
        version: 'v1',
        chunkCount: 5,
        embeddedChunkCount: 5,
        createdBy: 'user-1',
        metadata: {},
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z'
      });

      expect(result.status).toBe('ready');
    });
  });

  describe('findDocument', () => {
    it('returns a document when found', async () => {
      const client = createMockClient([documentRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.findDocument('doc-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('doc-1');
    });

    it('returns undefined when not found', async () => {
      const client = createMockClient([]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.findDocument('missing');

      expect(result).toBeUndefined();
    });
  });

  describe('deleteDocument', () => {
    it('deletes a document', async () => {
      const client = createMockClient();
      const repo = new PostgresKnowledgeRepository(client);

      await repo.deleteDocument('doc-1');

      expect(client.query).toHaveBeenCalled();
    });
  });

  describe('listDocumentsForBase', () => {
    it('returns documents for a base', async () => {
      const client = createMockClient([documentRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.listDocumentsForBase('kb-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('createJob', () => {
    it('creates a job and returns the mapped record', async () => {
      const client = createMockClient([jobRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.createJob({
        id: 'job-1',
        documentId: 'doc-1',
        status: 'queued',
        stage: 'uploaded',
        currentStage: 'queued',
        stages: [{ stage: 'queued', status: 'queued', startedAt: '2026-05-01T00:00:00.000Z' }],
        progress: { percent: 0 },
        attempts: 1,
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z'
      });

      expect(result.id).toBe('job-1');
    });
  });

  describe('updateJob', () => {
    it('updates a job and returns the mapped record', async () => {
      const client = createMockClient([jobRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.updateJob({
        id: 'job-1',
        documentId: 'doc-1',
        status: 'completed',
        stage: 'done',
        currentStage: 'done',
        stages: [],
        progress: { percent: 100 },
        attempts: 1,
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z'
      });

      expect(result.status).toBe('completed');
    });
  });

  describe('findLatestJobForDocument', () => {
    it('returns a job when found', async () => {
      const client = createMockClient([jobRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.findLatestJobForDocument('doc-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('job-1');
    });

    it('returns undefined when not found', async () => {
      const client = createMockClient([]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.findLatestJobForDocument('missing');

      expect(result).toBeUndefined();
    });
  });

  describe('saveChunks', () => {
    it('deletes all chunks when empty array provided', async () => {
      const client = createMockClient();
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.saveChunks('doc-1', []);

      expect(result).toEqual([]);
    });

    it('saves chunks and returns mapped records', async () => {
      const client = createMockClient([chunkRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.saveChunks('doc-1', [
        {
          id: 'chk-1',
          documentId: 'doc-1',
          ordinal: 0,
          content: 'Hello world',
          tokenCount: 2,
          embeddingStatus: 'completed',
          vectorIndexStatus: 'completed',
          keywordIndexStatus: 'completed',
          metadata: {},
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z'
        }
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('chk-1');
    });
  });

  describe('listChunks', () => {
    it('returns chunks for a document', async () => {
      const client = createMockClient([chunkRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.listChunks('doc-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('createChatConversation', () => {
    it('creates a conversation and returns the mapped record', async () => {
      const client = createMockClient([conversationRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.createChatConversation({
        userId: 'user-1',
        title: 'Test Conversation',
        activeModelProfileId: 'default'
      });

      expect(result.id).toBe('conv-1');
    });
  });

  describe('listChatConversationsForUser', () => {
    it('returns conversations for a user', async () => {
      const client = createMockClient([conversationRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.listChatConversationsForUser('user-1');

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('listChatMessages', () => {
    it('returns messages for a conversation', async () => {
      const client = createMockClient([messageRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.listChatMessages('conv-1', 'user-1');

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('updateMessageFeedback', () => {
    it('updates feedback and returns the mapped record', async () => {
      const client = createMockClient([messageRow]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.updateMessageFeedback('msg-1', { rating: 'helpful' });

      expect(result).toBeDefined();
      expect(result!.id).toBe('msg-1');
    });

    it('returns undefined when message not found', async () => {
      const client = createMockClient([]);
      const repo = new PostgresKnowledgeRepository(client);

      const result = await repo.updateMessageFeedback('missing', { rating: 'helpful' });

      expect(result).toBeUndefined();
    });
  });
});
