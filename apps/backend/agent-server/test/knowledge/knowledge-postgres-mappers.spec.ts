import { describe, expect, it } from 'vitest';

import {
  mapBase,
  mapMember,
  mapUpload,
  mapDocument,
  mapJob,
  mapChunk,
  mapChatConversation,
  mapChatMessage
} from '../../src/domains/knowledge/repositories/knowledge-postgres.mappers';

describe('mapBase', () => {
  it('maps a row to KnowledgeBase', () => {
    const result = mapBase({
      id: 'kb-1',
      name: 'Test KB',
      description: 'A test knowledge base',
      created_by_user_id: 'user-1',
      status: 'active',
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.id).toBe('kb-1');
    expect(result.name).toBe('Test KB');
    expect(result.description).toBe('A test knowledge base');
    expect(result.createdByUserId).toBe('user-1');
    expect(result.status).toBe('active');
    expect(result.createdAt).toBeTruthy();
    expect(result.updatedAt).toBeTruthy();
  });

  it('defaults description to empty string when missing', () => {
    const result = mapBase({
      id: 'kb-1',
      name: 'Test KB',
      created_by_user_id: 'user-1',
      status: 'active',
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.description).toBe('');
  });
});

describe('mapMember', () => {
  it('maps a row to KnowledgeBaseMember', () => {
    const result = mapMember({
      knowledge_base_id: 'kb-1',
      user_id: 'user-1',
      role: 'owner',
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.knowledgeBaseId).toBe('kb-1');
    expect(result.userId).toBe('user-1');
    expect(result.role).toBe('owner');
  });
});

describe('mapUpload', () => {
  it('maps a row to KnowledgeUploadRecord', () => {
    const result = mapUpload({
      upload_id: 'up-1',
      knowledge_base_id: 'kb-1',
      filename: 'test.pdf',
      size_bytes: 1024,
      content_type: 'application/pdf',
      object_key: 'key-1',
      oss_url: 'oss://bucket/key',
      uploaded_by_user_id: 'user-1',
      uploaded_at: new Date('2026-05-11')
    });
    expect(result.uploadId).toBe('up-1');
    expect(result.filename).toBe('test.pdf');
    expect(result.size).toBe(1024);
  });
});

describe('mapDocument', () => {
  it('maps a row to KnowledgeDocumentRecord', () => {
    const result = mapDocument({
      id: 'doc-1',
      workspace_id: 'ws-1',
      knowledge_base_id: 'kb-1',
      upload_id: 'up-1',
      object_key: 'key-1',
      filename: 'test.pdf',
      title: 'Test Document',
      status: 'ready',
      version: '1',
      chunk_count: 10,
      embedded_chunk_count: 10,
      created_by: 'user-1',
      metadata: '{"key":"value"}',
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.id).toBe('doc-1');
    expect(result.sourceType).toBe('user-upload');
    expect(result.metadata).toEqual({ key: 'value' });
    expect(result.chunkCount).toBe(10);
  });

  it('handles null metadata', () => {
    const result = mapDocument({
      id: 'doc-1',
      workspace_id: 'ws-1',
      knowledge_base_id: 'kb-1',
      upload_id: 'up-1',
      object_key: 'key-1',
      filename: 'test.pdf',
      title: 'Test',
      status: 'ready',
      version: '1',
      chunk_count: 0,
      embedded_chunk_count: 0,
      created_by: 'user-1',
      metadata: null,
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.metadata).toEqual({});
  });

  it('handles object metadata', () => {
    const result = mapDocument({
      id: 'doc-1',
      workspace_id: 'ws-1',
      knowledge_base_id: 'kb-1',
      upload_id: 'up-1',
      object_key: 'key-1',
      filename: 'test.pdf',
      title: 'Test',
      status: 'ready',
      version: '1',
      chunk_count: 0,
      embedded_chunk_count: 0,
      created_by: 'user-1',
      metadata: { existing: true },
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.metadata).toEqual({ existing: true });
  });

  it('handles array metadata as empty object', () => {
    const result = mapDocument({
      id: 'doc-1',
      workspace_id: 'ws-1',
      knowledge_base_id: 'kb-1',
      upload_id: 'up-1',
      object_key: 'key-1',
      filename: 'test.pdf',
      title: 'Test',
      status: 'ready',
      version: '1',
      chunk_count: 0,
      embedded_chunk_count: 0,
      created_by: 'user-1',
      metadata: [1, 2, 3],
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.metadata).toEqual({});
  });

  it('handles non-object JSON string metadata as empty object', () => {
    const result = mapDocument({
      id: 'doc-1',
      workspace_id: 'ws-1',
      knowledge_base_id: 'kb-1',
      upload_id: 'up-1',
      object_key: 'key-1',
      filename: 'test.pdf',
      title: 'Test',
      status: 'ready',
      version: '1',
      chunk_count: 0,
      embedded_chunk_count: 0,
      created_by: 'user-1',
      metadata: '"just a string"',
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.metadata).toEqual({});
  });

  it('handles array JSON string metadata as empty object', () => {
    const result = mapDocument({
      id: 'doc-1',
      workspace_id: 'ws-1',
      knowledge_base_id: 'kb-1',
      upload_id: 'up-1',
      object_key: 'key-1',
      filename: 'test.pdf',
      title: 'Test',
      status: 'ready',
      version: '1',
      chunk_count: 0,
      embedded_chunk_count: 0,
      created_by: 'user-1',
      metadata: '[1,2,3]',
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.metadata).toEqual({});
  });
});

describe('mapJob', () => {
  it('maps a row to DocumentProcessingJobRecord', () => {
    const result = mapJob({
      id: 'job-1',
      document_id: 'doc-1',
      status: 'running',
      stage: 'embedding',
      current_stage: 'embedding',
      stages: [{ stage: 'parsing', status: 'succeeded' }],
      progress: '{"percent":50,"processedChunks":5,"totalChunks":10}',
      error: null,
      error_code: null,
      error_message: null,
      attempts: 1,
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.id).toBe('job-1');
    expect(result.progress.percent).toBe(50);
    expect(result.progress.processedChunks).toBe(5);
    expect(result.progress.totalChunks).toBe(10);
    expect(result.stages).toHaveLength(1);
    expect(result.error).toBeUndefined();
  });

  it('handles missing stages', () => {
    const result = mapJob({
      id: 'job-1',
      document_id: 'doc-1',
      status: 'running',
      stage: 'embedding',
      stages: 'not-array',
      progress: null,
      error: null,
      attempts: null,
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.stages).toEqual([]);
    expect(result.attempts).toBe(1);
    expect(result.progress.percent).toBe(0);
  });

  it('parses error from JSON string', () => {
    const result = mapJob({
      id: 'job-1',
      document_id: 'doc-1',
      status: 'failed',
      stage: 'embedding',
      stages: [],
      progress: null,
      error: '{"code":"EMBED_FAILED","message":"Embedding failed","retryable":true,"stage":"embedding"}',
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('EMBED_FAILED');
    expect(result.error?.retryable).toBe(true);
  });

  it('returns undefined error when missing required fields', () => {
    const result = mapJob({
      id: 'job-1',
      document_id: 'doc-1',
      status: 'failed',
      stage: 'embedding',
      stages: [],
      progress: null,
      error: '{"code":"SOME_CODE"}',
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.error).toBeUndefined();
  });

  it('handles non-finite percent in progress', () => {
    const result = mapJob({
      id: 'job-1',
      document_id: 'doc-1',
      status: 'running',
      stage: 'embedding',
      stages: [],
      progress: '{"percent":"not-a-number"}',
      error: null,
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.progress.percent).toBe(0);
  });

  it('handles error_code and error_message', () => {
    const result = mapJob({
      id: 'job-1',
      document_id: 'doc-1',
      status: 'failed',
      stage: 'embedding',
      stages: [],
      progress: null,
      error: null,
      error_code: 'RATE_LIMIT',
      error_message: 'Rate limit exceeded',
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.errorCode).toBe('RATE_LIMIT');
    expect(result.errorMessage).toBe('Rate limit exceeded');
  });

  it('handles missing error_code and error_message', () => {
    const result = mapJob({
      id: 'job-1',
      document_id: 'doc-1',
      status: 'running',
      stage: 'embedding',
      stages: [],
      progress: null,
      error: null,
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.errorCode).toBeUndefined();
    expect(result.errorMessage).toBeUndefined();
  });
});

describe('mapChunk', () => {
  it('maps a row to DocumentChunkRecord', () => {
    const result = mapChunk({
      id: 'chunk-1',
      document_id: 'doc-1',
      ordinal: 0,
      content: 'Hello world',
      token_count: 2,
      embedding_status: 'succeeded',
      vector_index_status: 'succeeded',
      keyword_index_status: 'pending',
      metadata: '{"source":"test"}',
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.id).toBe('chunk-1');
    expect(result.content).toBe('Hello world');
    expect(result.metadata).toEqual({ source: 'test' });
  });

  it('handles null metadata', () => {
    const result = mapChunk({
      id: 'chunk-1',
      document_id: 'doc-1',
      ordinal: 0,
      content: 'test',
      token_count: 1,
      embedding_status: 'pending',
      vector_index_status: 'pending',
      keyword_index_status: 'pending',
      metadata: null,
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.metadata).toEqual({});
  });
});

describe('mapChatConversation', () => {
  it('maps a row to KnowledgeChatConversationRecord', () => {
    const result = mapChatConversation({
      id: 'conv-1',
      user_id: 'user-1',
      title: 'Test Conversation',
      active_model_profile_id: 'profile-1',
      created_at: new Date('2026-05-11'),
      updated_at: new Date('2026-05-11')
    });
    expect(result.id).toBe('conv-1');
    expect(result.title).toBe('Test Conversation');
  });
});

describe('mapChatMessage', () => {
  it('maps a row to KnowledgeChatMessageRecord with valid data', () => {
    const result = mapChatMessage({
      id: 'msg-1',
      conversation_id: 'conv-1',
      user_id: 'user-1',
      role: 'assistant',
      content: 'Hello!',
      citations: '[]',
      route: '{"reason":"default"}',
      diagnostics: null,
      feedback: null,
      created_at: new Date('2026-05-11')
    });
    expect(result.id).toBe('msg-1');
    expect(result.role).toBe('assistant');
    expect(result.citations).toEqual([]);
  });

  it('includes modelProfileId and traceId when present', () => {
    const result = mapChatMessage({
      id: 'msg-1',
      conversation_id: 'conv-1',
      user_id: 'user-1',
      role: 'user',
      content: 'question',
      model_profile_id: 'p1',
      trace_id: 't1',
      citations: '[]',
      created_at: new Date('2026-05-11')
    });
    expect(result.modelProfileId).toBe('p1');
    expect(result.traceId).toBe('t1');
  });

  it('omits modelProfileId and traceId when falsy', () => {
    const result = mapChatMessage({
      id: 'msg-1',
      conversation_id: 'conv-1',
      user_id: 'user-1',
      role: 'user',
      content: 'question',
      model_profile_id: null,
      trace_id: null,
      citations: '[]',
      created_at: new Date('2026-05-11')
    });
    expect(result.modelProfileId).toBeUndefined();
    expect(result.traceId).toBeUndefined();
  });

  it('handles object citations', () => {
    const result = mapChatMessage({
      id: 'msg-1',
      conversation_id: 'conv-1',
      user_id: 'user-1',
      role: 'assistant',
      content: 'answer',
      citations: [{ id: 'c1', title: 'Doc', quote: 'text', documentId: 'd1', chunkId: 'c1', score: 0.9 }],
      created_at: new Date('2026-05-11')
    });
    expect(result.citations).toHaveLength(1);
  });
});

describe('toIsoString', () => {
  it('handles Date instances', () => {
    const result = mapBase({
      id: 'kb-1',
      name: 'Test',
      created_by_user_id: 'u1',
      status: 'active',
      created_at: new Date('2026-05-11T12:00:00Z'),
      updated_at: new Date('2026-05-11T12:00:00Z')
    });
    expect(result.createdAt).toBe('2026-05-11T12:00:00.000Z');
  });

  it('handles string dates', () => {
    const result = mapBase({
      id: 'kb-1',
      name: 'Test',
      created_by_user_id: 'u1',
      status: 'active',
      created_at: '2026-05-11T12:00:00Z',
      updated_at: '2026-05-11T12:00:00Z'
    });
    expect(result.createdAt).toBeTruthy();
  });
});
