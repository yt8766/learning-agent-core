import { describe, expect, it, vi } from 'vitest';

import { createKnowledgeApiClient } from '../src/api/knowledge-api-client';

describe('knowledge real API paths', () => {
  it('calls the knowledge-server base URL for knowledge bases', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ bases: [] }), { status: 200 }));
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3020/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.listKnowledgeBases();

    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:3020/api/knowledge/bases',
      expect.objectContaining({
        headers: expect.any(Headers)
      })
    );
    const [, init] = fetcher.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer access-token');
  });

  it('trims a trailing baseUrl slash before calling real backend paths', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ bases: [] }), { status: 200 }));
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3020/api/',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.listKnowledgeBases();

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3020/api/knowledge/bases');
  });

  it('uploads a knowledge file through knowledge-server', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          uploadId: 'upload_1',
          knowledgeBaseId: 'kb_1',
          filename: 'runbook.md',
          size: 12,
          contentType: 'text/markdown',
          objectKey: 'knowledge/kb_1/upload_1/runbook.md',
          ossUrl: 'oss://bucket/knowledge/kb_1/upload_1/runbook.md',
          uploadedAt: '2026-05-02T00:00:00.000Z'
        }),
        { status: 200 }
      )
    );
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3020/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    const file = new File(['hello'], 'runbook.md', { type: 'text/markdown' });
    await client.uploadKnowledgeFile({ knowledgeBaseId: 'kb_1', file });

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3020/api/knowledge/bases/kb_1/uploads');
    const [, init] = fetcher.mock.calls[0] ?? [];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get('file')).toBe(file);
  });

  it('creates a document from an upload result', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ document: { id: 'doc_1' }, job: { id: 'job_1' } }), { status: 200 })
      );
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3020/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.createDocumentFromUpload('kb_1', {
      uploadId: 'upload_1',
      objectKey: 'knowledge/kb_1/upload_1/runbook.md',
      filename: 'runbook.md'
    });

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3020/api/knowledge/bases/kb_1/documents');
    expect(fetcher.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          uploadId: 'upload_1',
          objectKey: 'knowledge/kb_1/upload_1/runbook.md',
          filename: 'runbook.md'
        })
      })
    );
  });

  it('passes knowledgeBaseId when listing documents for a base detail view', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20 }), { status: 200 }));
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3020/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.listDocuments({ knowledgeBaseId: 'kb_1' });

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3020/api/documents?knowledgeBaseId=kb_1');
  });

  it('keeps legacy uploadDocument callers on the knowledge-server two-step upload contract', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            uploadId: 'upload_1',
            knowledgeBaseId: 'kb_1',
            filename: 'runbook.md',
            size: 12,
            contentType: 'text/markdown',
            objectKey: 'knowledge/kb_1/upload_1/runbook.md',
            ossUrl: 'oss://bucket/knowledge/kb_1/upload_1/runbook.md',
            uploadedAt: '2026-05-02T00:00:00.000Z'
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ document: { id: 'doc_1' }, job: { id: 'job_1' } }), { status: 200 })
      );
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3020/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    const file = new File(['hello'], 'runbook.md', { type: 'text/markdown' });
    await client.uploadDocument({ embeddingModelId: 'embed_openai_small', knowledgeBaseId: 'kb_1', file });

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'http://127.0.0.1:3020/api/knowledge/bases/kb_1/uploads',
      'http://127.0.0.1:3020/api/knowledge/bases/kb_1/documents'
    ]);
    expect(fetcher.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          filename: 'runbook.md',
          metadata: { embeddingModelId: 'embed_openai_small' },
          objectKey: 'knowledge/kb_1/upload_1/runbook.md',
          uploadId: 'upload_1'
        })
      })
    );
  });

  it('lists embedding model options through knowledge-server', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ id: 'embed_openai_small', name: 'OpenAI text-embedding-3-small', provider: 'openai' }],
          total: 1,
          page: 1,
          pageSize: 20
        }),
        { status: 200 }
      )
    );
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3020/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.listEmbeddingModels();

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3020/api/knowledge/embedding-models');
  });

  it('reprocesses a document through knowledge-server core operations path', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ document: { id: 'doc_1' }, job: { id: 'job_2' } }), { status: 200 })
      );
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3020/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.reprocessDocument('doc_1');

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3020/api/knowledge/documents/doc_1/reprocess');
    expect(fetcher.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({})
      })
    );
  });

  it('deletes a document through knowledge-server core operations path', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3020/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.deleteDocument('doc_1');

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3020/api/knowledge/documents/doc_1');
    expect(fetcher.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: 'DELETE'
      })
    );
  });
});
