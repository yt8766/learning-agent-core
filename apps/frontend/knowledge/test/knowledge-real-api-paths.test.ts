import { describe, expect, it, vi } from 'vitest';

import { createKnowledgeApiClient } from '../src/api/knowledge-api-client';

describe('knowledge real API paths', () => {
  it('calls the unified agent-server base URL for knowledge bases', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ bases: [] }), { status: 200 }));
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3000/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.listKnowledgeBases();

    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/knowledge/bases',
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
      baseUrl: 'http://127.0.0.1:3000/api/',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.listKnowledgeBases();

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/knowledge/bases');
  });

  it('uploads a knowledge file through unified agent-server', async () => {
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
      baseUrl: 'http://127.0.0.1:3000/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    const file = new File(['hello'], 'runbook.md', { type: 'text/markdown' });
    await client.uploadKnowledgeFile({ knowledgeBaseId: 'kb_1', file });

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/knowledge/bases/kb_1/uploads');
    const [, init] = fetcher.mock.calls[0] ?? [];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get('file')).toBe(file);
  });

  it('creates a document from an upload result', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ document: createDocumentResponse('doc_1'), job: createJobResponse('job_1') }), {
        status: 200
      })
    );
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3000/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.createDocumentFromUpload('kb_1', {
      uploadId: 'upload_1',
      objectKey: 'knowledge/kb_1/upload_1/runbook.md',
      filename: 'runbook.md'
    });

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/knowledge/bases/kb_1/documents');
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
      baseUrl: 'http://127.0.0.1:3000/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.listDocuments({ knowledgeBaseId: 'kb_1' });

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/knowledge/documents?knowledgeBaseId=kb_1');
  });

  it('keeps legacy uploadDocument callers on the unified agent-server two-step upload contract', async () => {
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
        new Response(JSON.stringify({ document: createDocumentResponse('doc_1'), job: createJobResponse('job_1') }), {
          status: 200
        })
      );
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3000/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    const file = new File(['hello'], 'runbook.md', { type: 'text/markdown' });
    await client.uploadDocument({ embeddingModelId: 'embed_openai_small', knowledgeBaseId: 'kb_1', file });

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'http://127.0.0.1:3000/api/knowledge/bases/kb_1/uploads',
      'http://127.0.0.1:3000/api/knowledge/bases/kb_1/documents'
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

  it('lists embedding model options through unified agent-server', async () => {
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
      baseUrl: 'http://127.0.0.1:3000/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.listEmbeddingModels();

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/knowledge/embedding-models');
  });

  it('reprocesses a document through unified agent-server core operations path', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ document: createDocumentResponse('doc_1'), job: createJobResponse('job_2') }), {
        status: 200
      })
    );
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3000/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.reprocessDocument('doc_1');

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/knowledge/documents/doc_1/reprocess');
    expect(fetcher.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({})
      })
    );
  });

  it('deletes a document through unified agent-server core operations path', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3000/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.deleteDocument('doc_1');

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/knowledge/documents/doc_1');
    expect(fetcher.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: 'DELETE'
      })
    );
  });

  it('lists agent flows through unified agent-server', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20 }), { status: 200 }));
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3000/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.listAgentFlows();

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/knowledge/agent-flows');
    expect(fetcher.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ method: 'GET' }));
  });

  it('loads knowledge governance pages through the knowledge API prefix', async () => {
    const fetcher = vi.fn<typeof fetch>(async url => {
      if (String(url).endsWith('/knowledge/settings/api-keys')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      if (String(url).endsWith('/knowledge/settings/model-providers')) {
        return new Response(JSON.stringify({ items: [], updatedAt: '2026-05-04T00:00:00.000Z' }), { status: 200 });
      }
      if (String(url).endsWith('/knowledge/settings/storage')) {
        return new Response(
          JSON.stringify({ buckets: [], knowledgeBases: [], updatedAt: '2026-05-04T00:00:00.000Z' }),
          { status: 200 }
        );
      }
      if (String(url).endsWith('/knowledge/settings/security')) {
        return new Response(
          JSON.stringify({
            ssoEnabled: false,
            mfaRequired: true,
            ipAllowlistEnabled: false,
            ipAllowlist: [],
            auditLogEnabled: true,
            passwordPolicy: 'strong',
            encryption: {
              enabled: true,
              transport: 'TLS 1.3',
              atRest: 'AES-256'
            },
            securityScore: 92,
            updatedAt: '2026-05-04T00:00:00.000Z'
          }),
          { status: 200 }
        );
      }
      if (String(url).endsWith('/knowledge/chat/assistant-config')) {
        return new Response(
          JSON.stringify({
            deepThinkEnabled: true,
            webSearchEnabled: false,
            modelProfileId: 'knowledge-rag',
            defaultKnowledgeBaseIds: [],
            quickPrompts: ['Summarize selected knowledge'],
            thinkingSteps: [],
            updatedAt: '2026-05-04T00:00:00.000Z'
          }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 404 });
    });
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3000/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.getSettingsApiKeys();
    await client.getSettingsModelProviders();
    await client.getSettingsStorage();
    await client.getSettingsSecurity();
    await client.getChatAssistantConfig();

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'http://127.0.0.1:3000/api/knowledge/settings/api-keys',
      'http://127.0.0.1:3000/api/knowledge/settings/model-providers',
      'http://127.0.0.1:3000/api/knowledge/settings/storage',
      'http://127.0.0.1:3000/api/knowledge/settings/security',
      'http://127.0.0.1:3000/api/knowledge/chat/assistant-config'
    ]);
  });

  it('runs an agent flow through unified agent-server', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          runId: 'run_1',
          flowId: 'flow_default_rag',
          status: 'completed',
          output: {},
          createdAt: '2026-05-04T00:00:00.000Z',
          updatedAt: '2026-05-04T00:00:00.000Z'
        }),
        { status: 200 }
      )
    );
    const client = createKnowledgeApiClient({
      baseUrl: 'http://127.0.0.1:3000/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });
    const input = {
      flowId: 'flow_default_rag',
      input: {
        message: 'How should I route this?',
        knowledgeBaseIds: ['kb_1'],
        variables: {}
      }
    };

    await client.runAgentFlow('flow_default_rag', input);

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/knowledge/agent-flows/flow_default_rag/run');
    expect(fetcher.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(input)
      })
    );
  });
});

function createDocumentResponse(id: string) {
  return {
    id,
    workspaceId: 'default',
    knowledgeBaseId: 'kb_1',
    uploadId: 'upload_1',
    objectKey: 'knowledge/kb_1/upload_1/runbook.md',
    filename: 'runbook.md',
    title: 'runbook',
    sourceType: 'user-upload',
    status: 'queued',
    version: 'v1',
    chunkCount: 0,
    embeddedChunkCount: 0,
    createdBy: 'user_1',
    metadata: {},
    createdAt: '2026-05-02T00:00:00.000Z',
    updatedAt: '2026-05-02T00:00:00.000Z'
  };
}

function createJobResponse(id: string) {
  return {
    id,
    documentId: 'doc_1',
    stage: 'uploaded',
    status: 'queued',
    currentStage: 'queued',
    stages: [{ stage: 'queued', status: 'queued', startedAt: '2026-05-02T00:00:00.000Z' }],
    progress: { percent: 0 },
    attempts: 1,
    createdAt: '2026-05-02T00:00:00.000Z',
    updatedAt: '2026-05-02T00:00:00.000Z'
  };
}
