import { ChevronLeft, ChevronRight, Filter, Search, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  GatewayAuthFile,
  GatewayAuthFileBatchUploadRequest,
  GatewayAuthFileListResponse,
  GatewayAuthFileModelListResponse,
  GatewayAuthFilePatchRequest,
  GatewayProviderKind,
  GatewayUpdateOAuthModelAliasRulesRequest
} from '@agent/core';
import { AuthFileGrid, AuthOperationStrip } from './auth-files-manager-page.components';
import {
  AuthFileModelsModal,
  AuthFilePatchFieldsModal,
  parseAuthFileHeaders,
  parseAuthFileMetadata
} from './auth-files-manager-page.modals';
import { AuthFilesOAuthAliasPanel } from './auth-files-manager-page-oauth-aliases';
import {
  buildFilterTags,
  buildWildcardSearch,
  formatModelCount,
  getErrorMessage,
  isProblemAuthFile,
  mapAuthFile,
  readAuthFilesManagerPageState,
  readUploadFiles,
  sortAuthFiles,
  writeAuthFilesManagerPageState,
  type AuthFileSortMode
} from './auth-files-manager-page.model';

interface AuthFilesManagerPageProps {
  authFiles?: GatewayAuthFileListResponse;
  onBatchUpload?: (files: GatewayAuthFileBatchUploadRequest['files']) => Promise<unknown> | void;
  onBatchDownload?: (authFileIds: string[]) => Promise<unknown> | void;
  onBatchDelete?: (fileNames: string[]) => Promise<unknown> | void;
  onToggleStatus?: (authFileId: string, nextDisabled?: boolean) => Promise<unknown> | void;
  onPatchFields?: (
    authFileId: string,
    patch?: Omit<GatewayAuthFilePatchRequest, 'authFileId'>
  ) => Promise<unknown> | void;
  onListModels?: (authFileId: string) => Promise<unknown> | void;
  onLoadOAuthAliases?: (providerId: string) => Promise<unknown> | void;
  onSaveOAuthAliases?: (
    providerId: string,
    request: GatewayUpdateOAuthModelAliasRulesRequest
  ) => Promise<unknown> | void;
}

interface AuthFilesManagerPageState {
  authFileId: string;
  authFileName: string;
}

interface AuthFileModelsModalLocalState {
  authFileId: string;
  authFileName: string;
  error: string | null;
  loading: boolean;
  models: GatewayAuthFileModelListResponse['models'];
  open: boolean;
}

interface AuthFilePatchModalState extends AuthFilesManagerPageState {
  accountEmail: string;
  error: string | null;
  metadataText: string;
  note: string;
  open: boolean;
  prefix: string;
  priority: string;
  projectId: string;
  proxyUrl: string;
  providerId: string;
  saving: boolean;
  authStatus: GatewayAuthFile['status'];
  statusText: string;
  disabled: boolean;
  headersText: string;
}

export function AuthFilesManagerPage({
  authFiles,
  onBatchDelete,
  onBatchDownload,
  onBatchUpload,
  onListModels,
  onPatchFields,
  onLoadOAuthAliases,
  onSaveOAuthAliases,
  onToggleStatus
}: AuthFilesManagerPageProps) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [uiStateHydrated, setUiStateHydrated] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [regularPageSize, setRegularPageSize] = useState('12');
  const [compactPageSize, setCompactPageSize] = useState('12');
  const [sortBy, setSortBy] = useState<AuthFileSortMode>('updated');
  const [showProblemOnly, setShowProblemOnly] = useState(false);
  const [showDisabledOnly, setShowDisabledOnly] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [relationView, setRelationView] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [operationStatus, setOperationStatus] = useState<{ kind: 'idle' | 'success' | 'error'; message: string }>({
    kind: 'idle',
    message: '等待操作'
  });
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [modelsModalState, setModelsModalState] = useState<AuthFileModelsModalLocalState>({
    authFileId: '',
    authFileName: '',
    error: null,
    loading: false,
    models: [],
    open: false
  });
  const [patchModalState, setPatchModalState] = useState<AuthFilePatchModalState>({
    authFileId: '',
    authFileName: '',
    accountEmail: '',
    disabled: false,
    error: null,
    headersText: '',
    metadataText: '',
    note: '',
    open: false,
    prefix: '',
    priority: '',
    providerId: '',
    projectId: '',
    proxyUrl: '',
    saving: false,
    authStatus: 'valid',
    statusText: ''
  });

  const files = useMemo(() => (authFiles ? authFiles.items.map(mapAuthFile) : []), [authFiles]);
  const tagCounts = useMemo(() => buildFilterTags(files), [files]);

  const filteredFiles = useMemo(() => {
    const trimmedQuery = query.trim();
    const normalizedQuery = trimmedQuery.toLowerCase();
    const wildcardQuery = buildWildcardSearch(trimmedQuery);

    const result = files.filter(file => {
      const providerMatches = activeProvider === 'all' || file.providerKind === activeProvider;
      if (!providerMatches) return false;
      if (showProblemOnly && !isProblemAuthFile(file)) return false;
      if (showDisabledOnly && !file.disabled) return false;
      if (!trimmedQuery) return true;

      const searchable = file.searchText || '';
      if (wildcardQuery) {
        return wildcardQuery.test(searchable);
      }

      return (
        file.name.toLowerCase().includes(normalizedQuery) ||
        file.fileName.toLowerCase().includes(normalizedQuery) ||
        file.provider.toLowerCase().includes(normalizedQuery) ||
        file.filePath.toLowerCase().includes(normalizedQuery) ||
        file.detail.toLowerCase().includes(normalizedQuery) ||
        searchable.includes(normalizedQuery)
      );
    });

    return sortAuthFiles(result, sortBy);
  }, [activeProvider, files, query, showDisabledOnly, showProblemOnly, sortBy]);

  const pageSize = compactMode ? compactPageSize : regularPageSize;
  const numericPageSize = Math.max(1, Number.parseInt(pageSize, 10) || 12);
  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / numericPageSize));

  useEffect(() => {
    const persistedState = readAuthFilesManagerPageState();
    setActiveProvider(persistedState.activeProvider);
    setQuery(persistedState.query);
    setRegularPageSize(persistedState.regularPageSize);
    setCompactPageSize(persistedState.compactPageSize);
    setSortBy(persistedState.sortBy);
    setShowProblemOnly(persistedState.showProblemOnly);
    setShowDisabledOnly(persistedState.showDisabledOnly);
    setCompactMode(persistedState.compactMode);
    setRelationView(persistedState.relationView);
    setCurrentPage(persistedState.currentPage);
    setUiStateHydrated(true);
  }, []);

  useEffect(() => {
    if (!uiStateHydrated) return;
    writeAuthFilesManagerPageState({
      activeProvider,
      compactMode,
      compactPageSize,
      currentPage,
      query,
      relationView,
      regularPageSize,
      showDisabledOnly,
      showProblemOnly,
      sortBy
    });
  }, [
    activeProvider,
    compactMode,
    compactPageSize,
    currentPage,
    query,
    relationView,
    regularPageSize,
    showDisabledOnly,
    showProblemOnly,
    sortBy,
    uiStateHydrated
  ]);

  useEffect(() => {
    setCurrentPage(currentPage => Math.min(currentPage, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeProvider,
    authFiles,
    compactMode,
    compactPageSize,
    query,
    regularPageSize,
    showDisabledOnly,
    showProblemOnly,
    sortBy
  ]);

  const pageStart = (currentPage - 1) * numericPageSize;
  const pageFiles = filteredFiles.slice(pageStart, pageStart + numericPageSize);

  const selectedFileNames = useMemo(
    () => files.filter(file => selectedFileIds.has(file.id)).map(file => file.fileName),
    [files, selectedFileIds]
  );

  const hasSelection = selectedFileIds.size > 0;

  const runOperation = async (label: string, operation?: () => Promise<unknown> | unknown): Promise<void> => {
    if (!operation) {
      setOperationStatus({ kind: 'error', message: `${label}失败：当前页面尚未接入该操作。` });
      return;
    }
    setBusyAction(label);
    setOperationStatus({ kind: 'idle', message: `${label}处理中` });
    try {
      await operation();
      setOperationStatus({ kind: 'success', message: `${label}已提交。` });
    } catch (error) {
      setOperationStatus({ kind: 'error', message: `${label}失败：${getErrorMessage(error)}` });
    } finally {
      setBusyAction(null);
    }
  };

  const openUploadPicker = (): void => {
    uploadInputRef.current?.click();
    setOperationStatus({ kind: 'idle', message: '请选择要上传的 JSON 文件。' });
  };

  const runBatchDelete = async () => {
    if (selectedFileNames.length === 0) {
      throw new Error('尚未选择要删除的认证文件');
    }
    if (!onBatchDelete) {
      throw new Error('当前页面尚未接入删除操作');
    }
    return onBatchDelete(selectedFileNames);
  };

  const runBatchDownload = async (options: { authFileIds: string[] }) => {
    if (options.authFileIds.length === 0) {
      throw new Error('尚未选择要下载的认证文件');
    }
    if (!onBatchDownload) {
      throw new Error('当前页面尚未接入下载操作');
    }
    return onBatchDownload(options.authFileIds);
  };

  const runBatchStatusToggle = async (): Promise<void> => {
    const authFileIds = Array.from(selectedFileIds);
    if (authFileIds.length === 0) {
      throw new Error('尚未选择要切换状态的认证文件');
    }
    if (!onToggleStatus) {
      throw new Error('当前页面尚未接入状态切换操作');
    }
    for (const authFileId of authFileIds) {
      const file = files.find(item => item.id === authFileId);
      await onToggleStatus(authFileId, !file?.disabled);
    }
  };

  const runFirstRecordOperation = (label: string, handler?: (authFileId: string) => Promise<unknown> | void): void => {
    const firstFileId = pageFiles[0]?.id ?? files[0]?.id;
    if (!firstFileId) {
      setOperationStatus({ kind: 'error', message: `${label}失败：暂无可操作的认证文件。` });
      return;
    }
    void runOperation(label, handler ? () => handler(firstFileId) : undefined);
  };

  const openModelsModal = async (authFileId: string): Promise<void> => {
    const file = files.find(item => item.id === authFileId);
    if (!file) throw new Error('未找到对应认证文件');

    setModelsModalState({
      authFileId: file.id,
      authFileName: file.name,
      error: null,
      loading: true,
      models: [],
      open: true
    });

    try {
      if (!onListModels) {
        throw new Error('当前页面尚未接入模型列举操作');
      }
      const response = await onListModels(authFileId);
      const models = parseAuthFileModelListResponse(response);
      setModelsModalState(current => ({
        ...current,
        loading: false,
        models
      }));
      setOperationStatus({ kind: 'success', message: `已获取 ${models.length} 个模型。` });
    } catch (error) {
      const message = getErrorMessage(error);
      setModelsModalState(current => ({
        ...current,
        loading: false,
        error: message
      }));
      setOperationStatus({ kind: 'error', message: `模型列举失败：${message}` });
      throw error;
    }
  };

  const closeModelsModal = (): void => {
    setModelsModalState(current => ({
      ...current,
      open: false,
      error: null
    }));
  };

  const openPatchModal = (authFileId: string): void => {
    const file = files.find(item => item.id === authFileId);
    if (!file) {
      setOperationStatus({ kind: 'error', message: '字段修补失败：未找到对应认证文件。' });
      return;
    }

    setPatchModalState({
      authFileId: file.id,
      authFileName: file.name,
      accountEmail: file.accountEmail,
      disabled: Boolean(file.disabled),
      error: null,
      headersText: file.headers ? JSON.stringify(file.headers, null, 2) : '{}',
      metadataText: file.metadata ? JSON.stringify(file.metadata, null, 2) : '{}',
      note: file.note ?? '',
      open: true,
      prefix: file.prefix ?? '',
      priority: file.priority === undefined ? '' : String(file.priority),
      providerId: file.providerId,
      projectId: file.projectId,
      proxyUrl: file.proxyUrl ?? '',
      saving: false,
      authStatus: file.status,
      statusText: '已加载当前记录。'
    });
  };

  const closePatchModal = (): void => {
    setPatchModalState(current => ({
      ...current,
      open: false,
      error: null,
      saving: false,
      statusText: ''
    }));
  };

  const handlePatchFieldChange = (
    field:
      | 'accountEmail'
      | 'authStatus'
      | 'disabled'
      | 'headersText'
      | 'metadataText'
      | 'note'
      | 'prefix'
      | 'priority'
      | 'projectId'
      | 'providerId'
      | 'proxyUrl',
    value: string | boolean
  ): void => {
    setPatchModalState(current =>
      field === 'authStatus'
        ? {
            ...current,
            authStatus: value as GatewayAuthFile['status'],
            statusText: '已编辑未保存。',
            error: null
          }
        : {
            ...current,
            [field]: value,
            statusText: '已编辑未保存。',
            error: null
          }
    );
  };

  const submitPatchFields = async (): Promise<void> => {
    if (!onPatchFields) {
      throw new Error('当前页面尚未接入字段修补操作');
    }

    const providerId = patchModalState.providerId.trim();
    const accountEmail = patchModalState.accountEmail.trim();
    const projectId = patchModalState.projectId.trim();
    const metadataText = patchModalState.metadataText.trim();
    const headersText = patchModalState.headersText.trim();
    const note = patchModalState.note.trim();
    const prefix = patchModalState.prefix.trim();
    const priorityText = patchModalState.priority.trim();
    const proxyUrl = patchModalState.proxyUrl.trim();

    const payload: Omit<GatewayAuthFilePatchRequest, 'authFileId'> = {};
    if (providerId) {
      payload.providerId = providerId;
    }
    if (accountEmail) {
      payload.accountEmail = accountEmail;
    }
    if (projectId) {
      payload.projectId = projectId;
    }
    payload.disabled = patchModalState.disabled;
    payload.status = patchModalState.authStatus;
    payload.note = note || null;
    payload.prefix = prefix || null;
    payload.proxyUrl = proxyUrl || null;
    if (priorityText) {
      const priority = Number(priorityText);
      if (!Number.isInteger(priority)) {
        throw new Error('priority 必须是整数。');
      }
      payload.priority = priority;
    }
    if (headersText) {
      payload.headers = parseAuthFileHeaders(headersText);
    }
    if (metadataText) {
      payload.metadata = parseAuthFileMetadata(metadataText);
    }
    if (Object.keys(payload).length === 0) {
      payload.metadata = { touchedBy: 'agent-gateway-ui' };
    }

    setPatchModalState(current => ({
      ...current,
      saving: true,
      error: null,
      statusText: '正在提交…'
    }));
    try {
      await onPatchFields(patchModalState.authFileId, payload);
      setPatchModalState(current => ({
        ...current,
        saving: false,
        statusText: '已提交。'
      }));
      setOperationStatus({ kind: 'success', message: '字段修补已提交。' });
      closePatchModal();
    } catch (error) {
      const message = getErrorMessage(error);
      setPatchModalState(current => ({
        ...current,
        saving: false,
        error: message,
        statusText: `提交失败：${message}`
      }));
      setOperationStatus({ kind: 'error', message: `字段修补失败：${message}` });
      throw error;
    }
  };

  const resetFilters = (): void => {
    setActiveProvider('all');
    setQuery('');
    setCompactPageSize('12');
    setRegularPageSize('12');
    setSortBy('updated');
    setShowProblemOnly(false);
    setShowDisabledOnly(false);
    setCompactMode(false);
    setRelationView(false);
    setSelectedFileIds(new Set());
    setOperationStatus({ kind: 'success', message: '筛选条件已重置。' });
  };

  const handleBrowseMode = (action: string): void => {
    if (action === '筛选') {
      resetFilters();
      return;
    }
    if (action === '搜索') {
      searchInputRef.current?.focus();
      setOperationStatus({ kind: 'idle', message: '搜索框已聚焦。' });
      return;
    }
    if (action === '分页') {
      const next = pageSize === '12' ? '24' : '12';
      if (compactMode) {
        setCompactPageSize(next);
      } else {
        setRegularPageSize(next);
      }
      setCurrentPage(1);
      setOperationStatus({ kind: 'success', message: '分页数量已切换。' });
      return;
    }
    if (action === '紧凑') {
      setCompactMode(current => !current);
      setCurrentPage(1);
      setOperationStatus({ kind: 'success', message: '紧凑模式已切换。' });
      return;
    }
    setRelationView(current => !current);
    setOperationStatus({ kind: 'success', message: '关系图视图已切换。' });
  };

  const handleSelectFile = (fileId: string, selected: boolean): void => {
    setSelectedFileIds(previous => {
      const next = new Set(previous);
      if (selected) {
        next.add(fileId);
      } else {
        next.delete(fileId);
      }
      return next;
    });
  };

  const handleSelectPage = (selected: boolean): void => {
    setSelectedFileIds(previous => {
      const next = new Set(previous);
      pageFiles.forEach(file => {
        if (file.runtimeOnly) return;
        if (selected) {
          next.add(file.id);
        } else {
          next.delete(file.id);
        }
      });
      return next;
    });
  };

  const batchHandlers = {
    批量上传: openUploadPicker,
    批量下载: () => void runOperation('批量下载', () => runBatchDownload({ authFileIds: Array.from(selectedFileIds) })),
    批量删除: () => void runOperation('批量删除', () => runBatchDelete()),
    批量状态切换: () => void runOperation('批量状态切换', () => runBatchStatusToggle()),
    选中筛选结果: () => {
      setSelectedFileIds(new Set(filteredFiles.filter(file => !file.runtimeOnly).map(file => file.id)));
      setOperationStatus({ kind: 'success', message: `已选中 ${filteredFiles.length} 条筛选结果。` });
    },
    反选当前页: () => {
      setSelectedFileIds(previous => {
        const next = new Set(previous);
        pageFiles.forEach(file => {
          if (file.runtimeOnly) return;
          if (next.has(file.id)) {
            next.delete(file.id);
          } else {
            next.add(file.id);
          }
        });
        return next;
      });
      setOperationStatus({ kind: 'success', message: '已反选当前页。' });
    },
    取消选择: () => {
      setSelectedFileIds(new Set());
      setOperationStatus({ kind: 'success', message: '已取消所有选择。' });
    }
  };

  const recordHandlers = {
    状态切换: () =>
      runFirstRecordOperation('状态切换', authFileId => {
        if (!onToggleStatus) throw new Error('当前页面尚未接入状态切换操作');
        const file = files.find(item => item.id === authFileId);
        return onToggleStatus(authFileId, !file?.disabled);
      }),
    字段修补: () =>
      runFirstRecordOperation('字段修补', authFileId => {
        openPatchModal(authFileId);
        return Promise.resolve(undefined);
      }),
    模型列举: () => runFirstRecordOperation('模型列举', openModelsModal)
  };

  const pageRangeLabel =
    filteredFiles.length === 0
      ? '0 - 0'
      : `${pageStart + 1} - ${Math.min(pageStart + numericPageSize, filteredFiles.length)}`;

  return (
    <section className="auth-files-clone gateway-management-page" aria-label="认证文件管理">
      <div className="auth-files-header">
        <div>
          <h1 className="management-page-title">认证文件管理</h1>
          <p>管理 OAuth 与本地凭据文件，支持筛选、分页、批量操作和模型列举。</p>
        </div>
        <div className="auth-header-actions">
          <input
            ref={uploadInputRef}
            multiple
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={event => {
              const input = event.currentTarget;
              void runOperation('批量上传', async () => {
                const files = await readUploadFiles(input.files);
                if (files.length === 0) throw new Error('没有选择可上传的文件');
                if (!onBatchUpload) throw new Error('当前页面尚未接入该操作');
                return onBatchUpload(files);
              }).finally(() => {
                input.value = '';
              });
            }}
          />
          <button onClick={resetFilters} type="button">
            <Filter size={16} aria-hidden="true" />
            重置筛选
          </button>
          <button
            className="auth-upload-action"
            disabled={busyAction === '批量上传'}
            type="button"
            onClick={openUploadPicker}
          >
            <Upload size={16} aria-hidden="true" />
            {busyAction === '批量上传' ? '上传中' : '批量上传'}
          </button>
          <button
            className="danger-action"
            disabled={busyAction === '批量删除' || !hasSelection}
            type="button"
            onClick={() => void runOperation('批量删除', () => runBatchDelete())}
            title={hasSelection ? '删除所选认证文件' : '先选择认证文件后再删除'}
          >
            删除
            {busyAction === '批量删除' ? '中' : ''}
          </button>
        </div>
      </div>

      <div className={`operation-feedback ${operationStatus.kind}`} role="status">
        {operationStatus.message}
      </div>

      <article className="auth-files-panel">
        <header className="auth-panel-title">
          <span>认证文件</span>
          <strong>{files.length}</strong>
        </header>

        <div className="auth-filter-rail">
          {tagCounts.map(tag => (
            <button
              className={`auth-filter-tag${activeProvider === tag.type ? ' active' : ''}`}
              key={tag.type}
              onClick={() => setActiveProvider(tag.type)}
              type="button"
            >
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
              <input
                ref={searchInputRef}
                onChange={event => setQuery(event.currentTarget.value)}
                placeholder="搜索文件名 / 提供商 / 路径 / Account"
                value={query}
              />
            </span>
          </label>
          <label>
            <span>每页数量</span>
            <select
              onChange={event => {
                const next = event.currentTarget.value;
                if (compactMode) {
                  setCompactPageSize(next);
                } else {
                  setRegularPageSize(next);
                }
              }}
              value={pageSize}
            >
              <option value="12">12</option>
              <option value="24">24</option>
              <option value="48">48</option>
            </select>
          </label>
          <label>
            <span>排序</span>
            <select onChange={event => setSortBy(event.currentTarget.value as AuthFileSortMode)} value={sortBy}>
              <option value="updated">最近更新</option>
              <option value="name">名称</option>
              <option value="provider">供应商</option>
              <option value="models">模型数量</option>
              <option value="status">状态</option>
              <option value="priority">优先级</option>
            </select>
          </label>
          <div className="auth-toggle-group" aria-label="显示选项">
            <button
              aria-pressed={showProblemOnly}
              type="button"
              onClick={() => setShowProblemOnly(current => !current)}
            >
              问题文件
            </button>
            <button
              aria-pressed={showDisabledOnly}
              type="button"
              onClick={() => setShowDisabledOnly(current => !current)}
            >
              已停用
            </button>
            <button aria-pressed={compactMode} type="button" onClick={() => setCompactMode(current => !current)}>
              紧凑
            </button>
          </div>
        </div>

        <AuthFileGrid
          busyAction={busyAction}
          compactMode={compactMode}
          filesLength={files.length}
          hasSelection={hasSelection}
          onBatchDownload={onBatchDownload ? authFileIds => runBatchDownload({ authFileIds }) : undefined}
          onDeleteFiles={onBatchDelete ? fileNames => onBatchDelete(fileNames) : undefined}
          onListModels={openModelsModal}
          onPatchFields={authFileId => {
            openPatchModal(authFileId);
            return Promise.resolve(undefined);
          }}
          onResetFilters={resetFilters}
          onSelectFile={handleSelectFile}
          onSelectPage={handleSelectPage}
          onToggleStatus={
            onToggleStatus ? (authFileId, nextDisabled) => onToggleStatus(authFileId, nextDisabled) : undefined
          }
          onUploadEmpty={openUploadPicker}
          runOperation={runOperation}
          selectedFileIds={selectedFileIds}
          visibleFiles={pageFiles}
          relationView={relationView}
        />

        {filteredFiles.length > 0 ? (
          <div className="auth-filter-controls" style={{ alignItems: 'center' }}>
            <div>
              当前：{pageRangeLabel} / 共 {filteredFiles.length}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                type="button"
              >
                <ChevronLeft size={14} aria-hidden="true" />
                上一页
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                type="button"
              >
                下一页
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
            <p className="provider-credential-row" style={{ margin: 0 }}>
              已选 {selectedFileIds.size} 项 · 展示{' '}
              {formatModelCount(pageFiles.reduce((total, file) => total + file.models, 0))}
            </p>
          </div>
        ) : null}
      </article>

      <AuthOperationStrip
        batchHandlers={batchHandlers}
        busyAction={busyAction}
        compactMode={compactMode}
        hasSelection={hasSelection}
        handleBrowseMode={handleBrowseMode}
        recordHandlers={recordHandlers}
        relationView={relationView}
      />

      <AuthFileModelsModal
        authFileId={modelsModalState.authFileId}
        authFileName={modelsModalState.authFileName}
        error={modelsModalState.error}
        loading={modelsModalState.loading}
        models={modelsModalState.models}
        onClose={closeModelsModal}
        open={modelsModalState.open}
      />

      <AuthFilePatchFieldsModal
        accountEmail={patchModalState.accountEmail}
        authStatus={patchModalState.authStatus}
        authFileId={patchModalState.authFileId}
        authFileName={patchModalState.authFileName}
        disabled={patchModalState.disabled}
        error={patchModalState.error}
        headersText={patchModalState.headersText}
        metadataText={patchModalState.metadataText}
        note={patchModalState.note}
        onChangeField={handlePatchFieldChange}
        onClose={closePatchModal}
        onSubmit={submitPatchFields}
        open={patchModalState.open}
        prefix={patchModalState.prefix}
        priority={patchModalState.priority}
        projectId={patchModalState.projectId}
        proxyUrl={patchModalState.proxyUrl}
        providerId={patchModalState.providerId}
        saving={patchModalState.saving}
        statusText={patchModalState.statusText}
      />

      <AuthFilesOAuthAliasPanel
        files={files}
        onLoadOAuthAliases={onLoadOAuthAliases}
        onSaveOAuthAliases={onSaveOAuthAliases}
      />
    </section>
  );
}

function parseAuthFileModelListResponse(response: unknown): GatewayAuthFileModelListResponse['models'] {
  if (response === null || response === undefined || typeof response !== 'object') {
    throw new Error('模型列举响应格式不合法。');
  }

  const current = response as { models?: unknown };
  if (!Array.isArray(current.models)) {
    throw new Error('模型列举返回字段 models 不存在或类型不正确。');
  }

  return current.models.map((model, index) => {
    if (!model || typeof model !== 'object') {
      throw new Error(`模型条目 #${index + 1} 格式不合法。`);
    }
    const maybe = model as {
      id?: unknown;
      displayName?: unknown;
      display_name?: unknown;
      providerKind?: unknown;
      type?: unknown;
      available?: unknown;
      aliases?: unknown;
    };
    const displayName =
      typeof maybe.displayName === 'string'
        ? maybe.displayName
        : typeof maybe.display_name === 'string'
          ? maybe.display_name
          : maybe.id;
    const providerKind =
      typeof maybe.providerKind === 'string'
        ? maybe.providerKind
        : typeof maybe.type === 'string'
          ? maybe.type
          : undefined;
    const available = typeof maybe.available === 'boolean' ? maybe.available : true;
    if (typeof maybe.id !== 'string' || typeof displayName !== 'string' || typeof providerKind !== 'string') {
      throw new Error(`模型条目 #${index + 1} 字段不合法。`);
    }
    if (maybe.aliases !== undefined && !Array.isArray(maybe.aliases)) {
      throw new Error(`模型条目 #${index + 1} 别名字段不合法。`);
    }
    if (maybe.aliases && !maybe.aliases.every(alias => typeof alias === 'string')) {
      throw new Error(`模型条目 #${index + 1} 别名字段不合法。`);
    }

    return {
      id: maybe.id,
      displayName,
      providerKind: providerKind as GatewayProviderKind,
      available,
      aliases: maybe.aliases as string[] | undefined
    };
  });
}
