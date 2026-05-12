/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

let mockUploadState: any = {
  files: [],
  uploading: false,
  progress: 0,
  error: null,
  status: 'idle',
  progressPercent: 0,
  uploadResult: null,
  job: null,
  addFiles: vi.fn(),
  removeFile: vi.fn(),
  startUpload: vi.fn(),
  reset: vi.fn(),
  upload: vi.fn()
};

vi.mock('@/hooks/use-document-upload', () => ({
  useDocumentUpload: vi.fn(() => mockUploadState)
}));

vi.mock('antd', () => ({
  Alert: ({ message, type }: any) => <div className={`alert alert-${type}`}>{message}</div>,
  Button: ({ children, type, disabled, loading, onClick }: any) => (
    <button className={`btn ${type ?? ''}`} disabled={disabled} data-loading={loading} onClick={onClick}>
      {children}
    </button>
  ),
  Card: ({ children, title }: any) => (
    <div className="card">
      <h3>{title}</h3>
      {children}
    </div>
  ),
  Descriptions: Object.assign(
    ({ children, bordered }: any) => (
      <dl className="descriptions" data-bordered={bordered}>
        {children}
      </dl>
    ),
    {
      Item: ({ children, label }: any) => (
        <div className="desc-item">
          <dt>{label}</dt>
          <dd>{children}</dd>
        </div>
      )
    }
  ),
  Progress: ({ percent, size, status }: any) => (
    <div className="progress" data-percent={percent} data-size={size} data-status={status}></div>
  ),
  Space: ({ children, orientation, size }: any) => (
    <div className="space" data-orientation={orientation} data-size={size}>
      {children}
    </div>
  ),
  Tag: ({ children }: any) => <span className="tag">{children}</span>,
  Typography: {
    Text: ({ children, type }: any) => <span data-type={type}>{children}</span>
  }
}));

vi.mock('@ant-design/icons', () => ({
  InboxOutlined: () => null,
  ReloadOutlined: () => null,
  UploadOutlined: () => null
}));

import { DocumentUploadPanel } from '@/pages/documents/document-upload-panel';

describe('DocumentUploadPanel', () => {
  it('renders the card title', () => {
    const html = renderToStaticMarkup(<DocumentUploadPanel knowledgeBaseId="kb-1" />);
    expect(html).toContain('上传文档');
  });

  it('renders the upload button', () => {
    const html = renderToStaticMarkup(<DocumentUploadPanel knowledgeBaseId="kb-1" />);
    expect(html).toContain('选择 Markdown/TXT');
  });

  it('renders supported file types', () => {
    const html = renderToStaticMarkup(<DocumentUploadPanel knowledgeBaseId="kb-1" />);
    expect(html).toContain('仅支持 Markdown 与 TXT 文件');
  });

  it('renders the reset button', () => {
    const html = renderToStaticMarkup(<DocumentUploadPanel knowledgeBaseId="kb-1" />);
    expect(html).toContain('重置');
  });

  it('renders with empty knowledgeBaseId', () => {
    const html = renderToStaticMarkup(<DocumentUploadPanel knowledgeBaseId="" />);
    expect(html).toContain('上传文档');
  });

  it('renders file input with accept filter', () => {
    const html = renderToStaticMarkup(<DocumentUploadPanel knowledgeBaseId="kb-1" />);
    expect(html).toContain('.md');
    expect(html).toContain('text/markdown');
  });

  it('renders the progress indicator', () => {
    const html = renderToStaticMarkup(<DocumentUploadPanel knowledgeBaseId="kb-1" />);
    expect(html).toContain('progress');
  });

  it('renders format guidance text', () => {
    const html = renderToStaticMarkup(<DocumentUploadPanel knowledgeBaseId="kb-1" />);
    expect(html).toContain('Markdown');
    expect(html).toContain('TXT');
  });

  it('renders the card wrapper', () => {
    const html = renderToStaticMarkup(<DocumentUploadPanel knowledgeBaseId="kb-1" />);
    expect(html).toContain('card');
  });

  it('renders idle status tag', () => {
    mockUploadState = { ...mockUploadState, status: 'idle' };
    const html = renderToStaticMarkup(<DocumentUploadPanel knowledgeBaseId="kb-1" />);
    expect(html).toContain('idle');
  });

  it('renders uploading status', () => {
    mockUploadState = { ...mockUploadState, status: 'uploading', progressPercent: 50 };
    const html = renderToStaticMarkup(<DocumentUploadPanel knowledgeBaseId="kb-1" />);
    expect(html).toContain('uploading');
    expect(html).toContain('50');
  });

  it('renders error alert when error present', () => {
    mockUploadState = { ...mockUploadState, status: 'failed', error: { message: 'Upload failed' } };
    const html = renderToStaticMarkup(<DocumentUploadPanel knowledgeBaseId="kb-1" />);
    expect(html).toContain('Upload failed');
    expect(html).toContain('alert-error');
  });

  it('renders upload result when available', () => {
    mockUploadState = {
      ...mockUploadState,
      status: 'done',
      error: null,
      uploadResult: { filename: 'test.md', size: '1.2 KB', objectKey: 'obj-key-1' }
    };
    const html = renderToStaticMarkup(<DocumentUploadPanel knowledgeBaseId="kb-1" />);
    expect(html).toContain('test.md');
    expect(html).toContain('1.2 KB');
    expect(html).toContain('obj-key-1');
  });

  it('renders job info when available', () => {
    mockUploadState = {
      ...mockUploadState,
      status: 'polling',
      job: { id: 'job-1', status: 'processing', currentStage: 'chunking' }
    };
    const html = renderToStaticMarkup(<DocumentUploadPanel knowledgeBaseId="kb-1" />);
    expect(html).toContain('job-1');
    expect(html).toContain('processing');
    expect(html).toContain('chunking');
  });

  it('renders job without currentStage', () => {
    mockUploadState = {
      ...mockUploadState,
      status: 'polling',
      job: { id: 'job-2', status: 'pending', currentStage: null }
    };
    const html = renderToStaticMarkup(<DocumentUploadPanel knowledgeBaseId="kb-1" />);
    expect(html).toContain('job-2');
  });

  it('renders with embeddingModelId prop', () => {
    mockUploadState = { ...mockUploadState, status: 'idle', error: null, uploadResult: null, job: null };
    const html = renderToStaticMarkup(<DocumentUploadPanel embeddingModelId="model-1" knowledgeBaseId="kb-1" />);
    expect(html).toContain('上传文档');
  });

  it('does not render error alert when no error', () => {
    mockUploadState = { ...mockUploadState, error: null };
    const html = renderToStaticMarkup(<DocumentUploadPanel knowledgeBaseId="kb-1" />);
    expect(html).not.toContain('alert-error');
  });
});
