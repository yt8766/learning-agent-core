/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';

let mockDetailState: any = {
  loading: false,
  error: null,
  knowledgeBase: {
    id: 'kb-1',
    name: 'Test Knowledge Base',
    status: 'active',
    documentCount: 10,
    chunkCount: 500,
    readyDocumentCount: 8,
    failedDocumentCount: 2,
    visibility: 'private',
    latestEvalScore: 92
  },
  documents: [
    {
      id: 'doc-1',
      title: 'README.md',
      filename: 'readme.md',
      sourceType: 'upload',
      status: 'ready',
      chunkCount: 50,
      embeddedChunkCount: 50,
      latestError: null
    },
    {
      id: 'doc-2',
      title: 'Guide',
      filename: 'guide.txt',
      sourceType: 'upload',
      status: 'failed',
      chunkCount: 0,
      embeddedChunkCount: 0,
      latestError: { message: 'Parse error', stage: 'parsing' }
    }
  ],
  reload: vi.fn()
};

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  useParams: vi.fn(() => ({ knowledgeBaseId: 'kb-1' }))
}));

vi.mock('@/hooks/use-knowledge-base-detail', () => ({
  useKnowledgeBaseDetail: vi.fn(() => mockDetailState)
}));

vi.mock('@/pages/documents/document-upload-panel', () => ({
  DocumentUploadPanel: ({ knowledgeBaseId }: any) => (
    <div className="upload-panel" data-kb={knowledgeBaseId}>
      Upload Panel
    </div>
  )
}));

vi.mock('@/pages/shared/ui', () => ({
  LifecycleRail: ({ steps }: any) => (
    <div className="lifecycle-rail">
      {steps?.map((s: any) => (
        <span key={s.key}>
          {s.title}: {s.metric}
        </span>
      ))}
    </div>
  ),
  MetricStrip: ({ metrics }: any) => (
    <div className="metric-strip">
      {metrics?.map((m: any) => (
        <span key={m.key}>
          {m.label}: {m.value}
        </span>
      ))}
    </div>
  ),
  RagOpsPage: ({ children, title, subTitle, eyebrow }: any) => (
    <section className="rag-ops-page">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{subTitle}</p>
      {children}
    </section>
  )
}));

vi.mock('antd', () => {
  const Descriptions = ({ children }: any) => <dl className="descriptions">{children}</dl>;
  Descriptions.Item = ({ children, label }: any) => (
    <div className="desc-item">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );

  return {
    Card: ({ children, className, title, loading }: any) => (
      <div className={`card ${className ?? ''}`} data-loading={loading}>
        {title ? <h3>{title}</h3> : null}
        {children}
      </div>
    ),
    Col: ({ children }: any) => <div className="col">{children}</div>,
    Descriptions,
    Row: ({ children }: any) => <div className="row">{children}</div>,
    Space: ({ children }: any) => <div className="space">{children}</div>,
    Table: ({ dataSource, loading, onRow }: any) => (
      <table className="table" data-count={dataSource?.length ?? 0} data-loading={loading}>
        {dataSource?.map((item: any) => (
          <tr key={item.id} data-onclick={onRow ? 'true' : 'false'}>
            <td>{item.title}</td>
            <td>{item.sourceType}</td>
            <td>{item.status}</td>
          </tr>
        ))}
      </table>
    ),
    Tag: ({ children, color }: any) => (
      <span className="tag" data-color={color}>
        {children}
      </span>
    ),
    Typography: {
      Text: ({ children, type }: any) => <span data-type={type}>{children}</span>
    }
  };
});

import { KnowledgeBaseDetailPage } from '@/pages/knowledge-bases/knowledge-base-detail-page';

function resetMockDetail() {
  mockDetailState = {
    loading: false,
    error: null,
    knowledgeBase: {
      id: 'kb-1',
      name: 'Test Knowledge Base',
      status: 'active',
      documentCount: 10,
      chunkCount: 500,
      readyDocumentCount: 8,
      failedDocumentCount: 2,
      visibility: 'private',
      latestEvalScore: 92
    },
    documents: [
      {
        id: 'doc-1',
        title: 'README.md',
        filename: 'readme.md',
        sourceType: 'upload',
        status: 'ready',
        chunkCount: 50,
        embeddedChunkCount: 50,
        latestError: null
      },
      {
        id: 'doc-2',
        title: 'Guide',
        filename: 'guide.txt',
        sourceType: 'upload',
        status: 'failed',
        chunkCount: 0,
        embeddedChunkCount: 0,
        latestError: { message: 'Parse error', stage: 'parsing' }
      }
    ],
    reload: vi.fn()
  };
}

describe('KnowledgeBaseDetailPage', () => {
  beforeEach(() => {
    resetMockDetail();
  });

  it('renders the page title', () => {
    const html = renderToStaticMarkup(<KnowledgeBaseDetailPage />);
    expect(html).toContain('Test Knowledge Base');
    expect(html).toContain('Knowledge Space Detail');
  });

  it('renders the subtitle', () => {
    const html = renderToStaticMarkup(<KnowledgeBaseDetailPage />);
    expect(html).toContain('上传、入库、索引、检索测试与质量回归的空间级视图');
  });

  it('renders metric strip', () => {
    const html = renderToStaticMarkup(<KnowledgeBaseDetailPage />);
    expect(html).toContain('metric-strip');
    expect(html).toContain('文档: 10');
    expect(html).toContain('Chunks: 500');
  });

  it('renders the summary card', () => {
    const html = renderToStaticMarkup(<KnowledgeBaseDetailPage />);
    expect(html).toContain('空间摘要');
    expect(html).toContain('rag-ops-panel');
  });

  it('renders the lifecycle rail', () => {
    const html = renderToStaticMarkup(<KnowledgeBaseDetailPage />);
    expect(html).toContain('lifecycle-rail');
    expect(html).toContain('空间生命周期');
    expect(html).toContain('来源');
    expect(html).toContain('切片');
  });

  it('renders the upload panel', () => {
    const html = renderToStaticMarkup(<KnowledgeBaseDetailPage />);
    expect(html).toContain('upload-panel');
    expect(html).toContain('data-kb="kb-1"');
  });

  it('renders the document table', () => {
    const html = renderToStaticMarkup(<KnowledgeBaseDetailPage />);
    expect(html).toContain('文档列表');
    expect(html).toContain('table');
    expect(html).toContain('data-count="2"');
  });

  it('renders the table card', () => {
    const html = renderToStaticMarkup(<KnowledgeBaseDetailPage />);
    expect(html).toContain('rag-ops-table-card');
  });

  it('renders description items', () => {
    const html = renderToStaticMarkup(<KnowledgeBaseDetailPage />);
    expect(html).toContain('desc-item');
  });

  it('renders document titles in table', () => {
    const html = renderToStaticMarkup(<KnowledgeBaseDetailPage />);
    expect(html).toContain('README.md');
    expect(html).toContain('Guide');
  });

  it('renders document status tags', () => {
    const html = renderToStaticMarkup(<KnowledgeBaseDetailPage />);
    expect(html).toContain('ready');
    expect(html).toContain('failed');
  });

  it('renders error state', () => {
    mockDetailState = {
      ...mockDetailState,
      error: new Error('Failed to load'),
      loading: false
    };
    const html = renderToStaticMarkup(<KnowledgeBaseDetailPage />);
    expect(html).toContain('Failed to load');
    expect(html).toContain('danger');
  });

  it('renders loading state', () => {
    mockDetailState = {
      ...mockDetailState,
      loading: true,
      error: null
    };
    const html = renderToStaticMarkup(<KnowledgeBaseDetailPage />);
    expect(html).toContain('data-loading="true"');
  });

  it('renders with null knowledgeBase', () => {
    mockDetailState = {
      ...mockDetailState,
      knowledgeBase: null,
      documents: [],
      loading: false,
      error: null
    };
    const html = renderToStaticMarkup(<KnowledgeBaseDetailPage />);
    expect(html).toContain('知识空间详情');
  });

  it('renders failed document count with critical status', () => {
    mockDetailState = {
      ...mockDetailState,
      knowledgeBase: {
        id: 'kb-1',
        name: 'Test Knowledge Base',
        status: 'active',
        documentCount: 10,
        chunkCount: 500,
        readyDocumentCount: 8,
        failedDocumentCount: 5,
        visibility: 'private',
        latestEvalScore: 92
      },
      loading: false,
      error: null
    };
    const html = renderToStaticMarkup(<KnowledgeBaseDetailPage />);
    expect(html).toContain('文档: 10');
  });

  it('renders with zero eval score', () => {
    mockDetailState = {
      ...mockDetailState,
      knowledgeBase: {
        id: 'kb-1',
        name: 'Test Knowledge Base',
        status: 'active',
        documentCount: 10,
        chunkCount: 500,
        readyDocumentCount: 8,
        failedDocumentCount: 2,
        visibility: 'private',
        latestEvalScore: null
      },
      loading: false,
      error: null
    };
    const html = renderToStaticMarkup(<KnowledgeBaseDetailPage />);
    expect(html).toContain('等待评测');
  });
});
