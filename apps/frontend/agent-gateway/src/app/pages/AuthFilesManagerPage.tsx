import { Download, FileJson, Filter, Search, SlidersHorizontal, Trash2, Upload } from 'lucide-react';
import type { GatewayAuthFile, GatewayAuthFileListResponse, GatewayProviderKind } from '@agent/core';
import claudeIcon from '../assets/provider-icons/claude.svg';
import codexIcon from '../assets/provider-icons/codex.svg';
import geminiIcon from '../assets/provider-icons/gemini.svg';
import vertexIcon from '../assets/provider-icons/vertex.svg';

const batchActions = ['批量上传', '批量下载', '批量删除'];
const recordActions = ['状态切换', '字段修补', '模型列举'];
const browseModes = ['筛选', '搜索', '分页', '紧凑', '关系图'];
const filterTags = [
  { type: 'all', label: '全部', count: 4, icon: null },
  { type: 'gemini', label: 'Gemini', count: 1, icon: geminiIcon },
  { type: 'codex', label: 'Codex', count: 1, icon: codexIcon },
  { type: 'claude', label: 'Claude', count: 1, icon: claudeIcon },
  { type: 'vertex', label: 'Vertex', count: 1, icon: vertexIcon }
];
const sampleFiles = [
  {
    id: 'sample-gemini-oauth',
    name: 'Gemini OAuth',
    file: 'gemini-oauth-prod.json',
    provider: 'Gemini',
    providerKind: 'gemini',
    status: 'ACTIVE',
    icon: geminiIcon,
    models: '12 models',
    detail: '最近同步于 12:24'
  },
  {
    id: 'sample-codex-session',
    name: 'Codex 会话',
    file: 'codex-session-main.json',
    provider: 'Codex',
    providerKind: 'codex',
    status: 'READY',
    icon: codexIcon,
    models: '8 models',
    detail: '最近同步于 12:24'
  },
  {
    id: 'sample-claude-console',
    name: 'Claude Console',
    file: 'claude-console-backup.json',
    provider: 'Claude',
    providerKind: 'claude',
    status: 'DISABLED',
    icon: claudeIcon,
    models: '5 models',
    detail: '最近同步于 12:24'
  }
];

interface AuthFilesManagerPageProps {
  authFiles?: GatewayAuthFileListResponse;
  onBatchUpload?: () => void;
  onBatchDownload?: () => void;
  onBatchDelete?: () => void;
  onToggleStatus?: (authFileId: string) => void;
  onPatchFields?: (authFileId: string) => void;
  onListModels?: (authFileId: string) => void;
}

export function AuthFilesManagerPage({
  authFiles,
  onBatchDelete,
  onBatchDownload,
  onBatchUpload,
  onListModels,
  onPatchFields,
  onToggleStatus
}: AuthFilesManagerPageProps) {
  const batchHandlers: Record<string, (() => void) | undefined> = {
    批量上传: onBatchUpload,
    批量下载: onBatchDownload,
    批量删除: onBatchDelete
  };
  const recordHandlers: Record<string, (() => void) | undefined> = {
    状态切换: () => authFiles?.items[0] && onToggleStatus?.(authFiles.items[0].id),
    字段修补: () => authFiles?.items[0] && onPatchFields?.(authFiles.items[0].id),
    模型列举: () => authFiles?.items[0] && onListModels?.(authFiles.items[0].id)
  };
  const files = authFiles ? authFiles.items.map(mapAuthFile) : sampleFiles;
  const tagCounts = buildFilterTags(files);

  return (
    <section className="auth-files-clone gateway-management-page" aria-label="认证文件管理">
      <div className="auth-files-header">
        <div>
          <h1 className="management-page-title">认证文件管理</h1>
          <p>管理 OAuth 与本地凭据文件，保留参考项目的筛选、批量操作、卡片视图与浮动批量操作体验。</p>
        </div>
        <div className="auth-header-actions">
          <button type="button">
            <SlidersHorizontal size={16} aria-hidden="true" />
            刷新
          </button>
          <button type="button" onClick={onBatchUpload}>
            <Upload size={16} aria-hidden="true" />
            批量上传
          </button>
          <button className="danger-action" type="button" onClick={onBatchDelete}>
            <Trash2 size={16} aria-hidden="true" />
            批量删除
          </button>
        </div>
      </div>

      <article className="auth-files-panel">
        <header className="auth-panel-title">
          <span>认证文件</span>
          <strong>{files.length}</strong>
        </header>

        <div className="auth-filter-rail">
          {tagCounts.map(tag => (
            <button className={`auth-filter-tag${tag.type === 'all' ? ' active' : ''}`} key={tag.type} type="button">
              <span className="auth-filter-icon">
                {tag.icon ? <img src={tag.icon} alt="" /> : <Filter size={16} aria-hidden="true" />}
              </span>
              <span>{tag.label}</span>
              <strong>{tag.count}</strong>
            </button>
          ))}
        </div>

        <div className="auth-filter-controls">
          <label>
            <span>搜索</span>
            <span className="auth-input-shell">
              <Search size={16} aria-hidden="true" />
              <input placeholder="搜索文件名或提供商" readOnly />
            </span>
          </label>
          <label>
            <span>每页数量</span>
            <input value="24" readOnly />
          </label>
          <label>
            <span>排序</span>
            <select defaultValue="updated">
              <option value="updated">最近更新</option>
              <option value="name">名称</option>
            </select>
          </label>
          <div className="auth-toggle-group" aria-label="显示选项">
            <span>问题文件</span>
            <span>已禁用</span>
            <span>紧凑模式</span>
          </div>
        </div>

        <div className="auth-file-grid">
          {files.length === 0 ? (
            <div className="provider-empty-state auth-empty-state">
              <span className="provider-empty-icon">
                <FileJson size={28} aria-hidden="true" />
              </span>
              <div>
                <h3>暂无认证文件</h3>
                <p>点击批量上传导入 OAuth 或服务账号 JSON。</p>
              </div>
            </div>
          ) : (
            files.map(file => (
              <article className="auth-file-card" key={file.file}>
                <div className="auth-file-card-main">
                  <span className="auth-file-avatar">
                    <img src={file.icon} alt="" />
                  </span>
                  <div>
                    <div className="auth-file-badges">
                      <span>{file.provider}</span>
                      <strong className={file.status === 'DISABLED' ? 'muted' : ''}>{file.status}</strong>
                    </div>
                    <h3>{file.name}</h3>
                    <p>{file.file}</p>
                    <small>
                      {file.models} · {file.detail}
                    </small>
                  </div>
                </div>
                <div className="auth-card-actions">
                  <button type="button" onClick={() => onListModels?.(file.id)}>
                    <FileJson size={15} aria-hidden="true" />
                    模型列举
                  </button>
                  <button type="button" onClick={() => onToggleStatus?.(file.id)}>
                    状态切换
                  </button>
                  <button type="button" onClick={() => onPatchFields?.(file.id)}>
                    字段修补
                  </button>
                  <button type="button" onClick={onBatchDownload}>
                    <Download size={15} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </article>

      <div className="auth-operation-strip">
        {[...batchActions, ...recordActions, ...browseModes].map(action => (
          <button key={action} type="button" onClick={batchHandlers[action] ?? recordHandlers[action]}>
            {action}
          </button>
        ))}
      </div>
    </section>
  );
}

function mapAuthFile(file: GatewayAuthFile) {
  const provider = providerLabel(file.providerKind);
  return {
    id: file.id,
    name: file.accountEmail ?? file.providerId,
    file: file.fileName,
    provider,
    providerKind: file.providerKind,
    status: file.status.toUpperCase(),
    icon: providerIcon(file.providerKind),
    models: `${file.modelCount} models`,
    detail: file.projectId ? `${file.accountEmail ?? '-'} · ${file.projectId}` : (file.accountEmail ?? file.path)
  };
}

function buildFilterTags(files: Array<ReturnType<typeof mapAuthFile> | (typeof sampleFiles)[number]>) {
  return filterTags.map(tag => {
    if (tag.type === 'all') return { ...tag, count: files.length };
    return {
      ...tag,
      count: files.filter(file => 'providerKind' in file && file.providerKind === tag.type).length
    };
  });
}

function providerIcon(providerKind: GatewayProviderKind): string {
  if (providerKind === 'codex') return codexIcon;
  if (providerKind === 'claude') return claudeIcon;
  if (providerKind === 'vertex') return vertexIcon;
  return geminiIcon;
}

function providerLabel(providerKind: GatewayProviderKind): string {
  if (providerKind === 'codex') return 'Codex';
  if (providerKind === 'claude') return 'Claude';
  if (providerKind === 'vertex') return 'Vertex';
  if (providerKind === 'openai-compatible') return 'OpenAI';
  return 'Gemini';
}
