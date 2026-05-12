import type { GatewayAuthFile, GatewayConfigValue, GatewayProviderKind } from '@agent/core';
import ampcdIcon from '../assets/provider-icons/amp.svg';
import claudeIcon from '../assets/provider-icons/claude.svg';
import codexIcon from '../assets/provider-icons/codex.svg';
import geminiIcon from '../assets/provider-icons/gemini.svg';
import openaiIcon from '../assets/provider-icons/openai-dark.svg';
import vertexIcon from '../assets/provider-icons/vertex.svg';

export type AuthFileSortMode = 'updated' | 'name' | 'provider' | 'models' | 'status' | 'priority';

export type AuthFileStatusTone = 'success' | 'warning' | 'error' | 'neutral';

export const AUTH_FILES_MANAGER_PAGE_STORAGE_KEY = 'agent-gateway:auth-files-manager-v1';

export interface AuthFilesManagerPageUiState {
  activeProvider: string;
  query: string;
  sortBy: AuthFileSortMode;
  showProblemOnly: boolean;
  showDisabledOnly: boolean;
  compactMode: boolean;
  relationView: boolean;
  regularPageSize: string;
  compactPageSize: string;
  currentPage: number;
}

export interface AuthFilesManagerPageRawStorageState {
  filter?: unknown;
  query?: unknown;
  sortBy?: unknown;
  problemOnly?: unknown;
  disabledOnly?: unknown;
  compactMode?: unknown;
  relationView?: unknown;
  page?: unknown;
  regularPageSize?: unknown;
  compactPageSize?: unknown;
  pageSize?: unknown;
}

export const DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE: AuthFilesManagerPageUiState = {
  activeProvider: 'all',
  compactMode: false,
  compactPageSize: '12',
  currentPage: 1,
  query: '',
  relationView: false,
  regularPageSize: '12',
  showDisabledOnly: false,
  showProblemOnly: false,
  sortBy: 'updated'
};

const PAGE_SIZE_OPTIONS = ['12', '24', '48'] as const;
const ALLOWED_SORT_MODES = new Set<AuthFileSortMode>(['updated', 'name', 'provider', 'models', 'status', 'priority']);

function isAuthFilesManagerSortMode(value: unknown): value is AuthFileSortMode {
  return typeof value === 'string' && ALLOWED_SORT_MODES.has(value as AuthFileSortMode);
}

function sanitizePageSize(value: unknown): string {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return PAGE_SIZE_OPTIONS.includes(String(value) as (typeof PAGE_SIZE_OPTIONS)[number])
      ? String(value)
      : DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE.regularPageSize;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return PAGE_SIZE_OPTIONS.includes(trimmed as (typeof PAGE_SIZE_OPTIONS)[number])
      ? trimmed
      : DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE.regularPageSize;
  }
  return DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE.regularPageSize;
}

function getStorage(storage?: Storage | null): Storage | null {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  return window.localStorage ?? null;
}

export function parseAuthFilesManagerPageState(raw: AuthFilesManagerPageRawStorageState): AuthFilesManagerPageUiState {
  return {
    activeProvider:
      typeof raw.filter === 'string' && raw.filter.trim()
        ? raw.filter.trim()
        : DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE.activeProvider,
    compactMode:
      typeof raw.compactMode === 'boolean' ? raw.compactMode : DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE.compactMode,
    compactPageSize: sanitizePageSize(raw.compactPageSize ?? raw.pageSize),
    currentPage: typeof raw.page === 'number' && Number.isFinite(raw.page) && raw.page > 0 ? Math.round(raw.page) : 1,
    query: typeof raw.query === 'string' ? raw.query : DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE.query,
    relationView:
      typeof raw.relationView === 'boolean' ? raw.relationView : DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE.relationView,
    regularPageSize: sanitizePageSize(raw.regularPageSize ?? raw.pageSize),
    showDisabledOnly:
      typeof raw.disabledOnly === 'boolean' ? raw.disabledOnly : DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE.showDisabledOnly,
    showProblemOnly:
      typeof raw.problemOnly === 'boolean' ? raw.problemOnly : DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE.showProblemOnly,
    sortBy: isAuthFilesManagerSortMode(raw.sortBy) ? raw.sortBy : DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE.sortBy
  };
}

export function readAuthFilesManagerPageState(storage?: Storage | null): AuthFilesManagerPageUiState {
  const actualStorage = getStorage(storage);
  if (!actualStorage) {
    return DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE;
  }

  try {
    const value = actualStorage.getItem(AUTH_FILES_MANAGER_PAGE_STORAGE_KEY);
    if (value == null) return DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE;
    const parsed = JSON.parse(value) as AuthFilesManagerPageRawStorageState;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE;
    return parseAuthFilesManagerPageState(parsed);
  } catch {
    return DEFAULT_AUTH_FILES_MANAGER_PAGE_STATE;
  }
}

export function writeAuthFilesManagerPageState(state: AuthFilesManagerPageUiState, storage?: Storage | null): void {
  const actualStorage = getStorage(storage);
  if (!actualStorage) return;
  const payload = {
    compactMode: state.compactMode,
    compactPageSize: state.compactPageSize,
    disabledOnly: state.showDisabledOnly,
    filter: state.activeProvider,
    page: state.currentPage,
    pageSize: state.regularPageSize,
    problemOnly: state.showProblemOnly,
    query: state.query,
    regularPageSize: state.regularPageSize,
    relationView: state.relationView,
    sortBy: state.sortBy
  };
  try {
    actualStorage.setItem(AUTH_FILES_MANAGER_PAGE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode errors
  }
}

export interface AuthFileListItem {
  id: string;
  name: string;
  fileName: string;
  filePath: string;
  provider: string;
  providerId: string;
  accountEmail: string;
  projectId: string;
  providerKind: GatewayProviderKind;
  status: GatewayAuthFile['status'];
  statusTone: AuthFileStatusTone;
  icon: string;
  statusLabel: string;
  metadata: Record<string, GatewayConfigValue> | null;
  models: number;
  updatedAt: string;
  updatedAtLabel: string;
  detail: string;
  authIndex?: string;
  disabled?: boolean;
  failedCount?: number;
  metadataEntries?: Array<{ key: string; value: string }>;
  note?: string;
  prefix?: string;
  priority?: number;
  proxyUrl?: string;
  relationLabel?: string;
  runtimeOnly?: boolean;
  searchText?: string;
  sizeLabel?: string;
  statusMessage?: string;
  successCount?: number;
  headers?: Record<string, string>;
}

export interface AuthFileUploadItem {
  fileName: string;
  contentBase64: string;
  providerKind?: GatewayProviderKind;
}

export interface AuthFileFilterTag {
  type: GatewayProviderKind | 'all';
  label: string;
  count: number;
  icon: string | null;
}

export const providerMetadata = [
  { kind: 'all' as const, label: '全部', icon: null },
  { kind: 'gemini' as const, label: 'Gemini', icon: geminiIcon },
  { kind: 'codex' as const, label: 'Codex', icon: codexIcon },
  { kind: 'claude' as const, label: 'Claude', icon: claudeIcon },
  { kind: 'vertex' as const, label: 'Vertex', icon: vertexIcon },
  { kind: 'openai-compatible' as const, label: 'OpenAI', icon: openaiIcon },
  { kind: 'ampcode' as const, label: 'Ampcode', icon: ampcdIcon }
] as const;

export const providerSections = providerMetadata;

export const batchActions = [
  '批量上传',
  '批量下载',
  '批量删除',
  '批量状态切换',
  '选中筛选结果',
  '反选当前页',
  '取消选择'
];
export const recordActions = ['状态切换', '字段修补', '模型列举'];
export const browseModes = ['筛选', '搜索', '分页', '紧凑', '关系图'];

const statusMetadata = {
  valid: {
    label: '有效',
    tone: 'success' as AuthFileStatusTone
  },
  invalid: {
    label: '异常',
    tone: 'error' as AuthFileStatusTone
  },
  missing: {
    label: '缺失',
    tone: 'warning' as AuthFileStatusTone
  },
  expired: {
    label: '过期',
    tone: 'neutral' as AuthFileStatusTone
  }
};

export function mapAuthFile(file: GatewayAuthFile): AuthFileListItem {
  const provider = providerLabel(file.providerKind);
  const metadata = file.metadata ?? null;
  const statusMessage =
    file.statusMessage ?? readMetadataText(metadata, ['statusMessage', 'status_message', 'message', 'error']);
  const disabled = file.disabled ?? readMetadataBoolean(metadata, ['disabled', 'isDisabled', 'disabled_status']);
  const runtimeOnly = file.runtimeOnly ?? readMetadataBoolean(metadata, ['runtimeOnly', 'runtime_only', 'virtual']);
  const priority = file.priority ?? readMetadataNumber(metadata, ['priority']);
  const note = file.note ?? readMetadataText(metadata, ['note', 'description', 'remark']);
  const prefix = file.prefix ?? readMetadataText(metadata, ['prefix']);
  const proxyUrl = file.proxyUrl ?? readMetadataText(metadata, ['proxyUrl', 'proxy_url', 'proxy-url']);
  const sizeBytes = file.sizeBytes ?? readMetadataNumber(metadata, ['size', 'sizeBytes', 'size_bytes']);
  const authIndex = file.authIndex ?? readMetadataText(metadata, ['authIndex', 'auth_index']);
  const successCount = file.successCount ?? readMetadataNumber(metadata, ['success', 'successCount', 'success_count']);
  const failedCount =
    file.failedCount ?? readMetadataNumber(metadata, ['failed', 'failure', 'failedCount', 'failed_count']);
  const metadataEntries = summarizeMetadata(metadata);
  const detail = [file.accountEmail, file.projectId, statusMessage].filter(Boolean).join(' · ') || file.path;
  const relationLabel = [provider, file.providerId, file.projectId || file.accountEmail || file.fileName]
    .filter(Boolean)
    .join(' → ');
  return {
    id: file.id,
    name: file.accountEmail || file.providerId,
    fileName: file.fileName,
    filePath: file.path,
    provider,
    providerId: file.providerId,
    accountEmail: file.accountEmail ?? '',
    projectId: file.projectId ?? '',
    providerKind: file.providerKind,
    status: file.status,
    statusTone: disabled ? 'neutral' : statusMetadata[file.status].tone,
    icon: providerIcon(file.providerKind),
    statusLabel: disabled ? '已停用' : formatStatus(file.status),
    metadata,
    models: file.modelCount,
    updatedAt: file.updatedAt,
    updatedAtLabel: formatUpdatedAt(file.updatedAt),
    detail,
    authIndex,
    disabled,
    failedCount,
    metadataEntries,
    note,
    prefix,
    priority,
    proxyUrl,
    relationLabel,
    runtimeOnly,
    searchText: [
      file.id,
      file.fileName,
      file.path,
      file.providerId,
      file.accountEmail,
      file.projectId,
      provider,
      statusMessage,
      note,
      prefix,
      proxyUrl,
      authIndex,
      metadataEntries.map(entry => `${entry.key}:${entry.value}`).join(' ')
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    sizeLabel: formatFileSize(sizeBytes),
    statusMessage,
    successCount,
    headers: file.headers
  };
}

export function buildFilterTags(files: AuthFileListItem[]): AuthFileFilterTag[] {
  return providerMetadata.map(tag => {
    if (tag.kind === 'all') {
      return { type: tag.kind, label: tag.label, icon: tag.icon, count: files.length };
    }

    return {
      type: tag.kind,
      label: tag.label,
      icon: tag.icon,
      count: files.filter(file => file.providerKind === tag.kind).length
    };
  });
}

export function sortAuthFiles(files: AuthFileListItem[], sortBy: AuthFileSortMode): AuthFileListItem[] {
  const list = [...files];
  if (sortBy === 'priority') {
    return list.sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));
  }
  if (sortBy === 'models') {
    return list.sort((left, right) => right.models - left.models);
  }
  if (sortBy === 'status') {
    return list.sort((left, right) => left.statusLabel.localeCompare(right.statusLabel));
  }
  if (sortBy === 'provider') {
    return list.sort((left, right) => left.provider.localeCompare(right.provider));
  }
  if (sortBy === 'name') {
    return list.sort((left, right) => left.name.localeCompare(right.name));
  }
  return list.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

export function isBrowseModeActive(action: string, compactMode: boolean, relationView: boolean): boolean {
  if (action === '紧凑') return compactMode;
  if (action === '关系图') return relationView;
  return false;
}

export function isProblemFile(status: GatewayAuthFile['status']): boolean {
  return status !== 'valid';
}

export function isProblemAuthFile(file: AuthFileListItem): boolean {
  return Boolean(file.disabled || file.runtimeOnly || file.statusMessage || isProblemFile(file.status));
}

export function buildWildcardSearch(value: string): RegExp | null {
  if (!value.includes('*')) return null;
  const pattern = value
    .split('*')
    .map(segment => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(pattern, 'i');
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '未知错误';
}

export async function readUploadFiles(fileList: FileList | null): Promise<AuthFileUploadItem[]> {
  if (!fileList) return [];
  const files = await Promise.all(
    Array.from(fileList).map(async file => ({
      fileName: file.name,
      contentBase64: await blobToBase64(file),
      providerKind: inferProviderKind(file.name)
    }))
  );
  return files;
}

export function formatModelCount(modelCount: number): string {
  return `${modelCount} models`;
}

function blobToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('无法读取文件内容'));
        return;
      }
      const markerIndex = reader.result.indexOf(',');
      resolve(markerIndex === -1 ? reader.result : reader.result.slice(markerIndex + 1));
    };

    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };

    reader.readAsDataURL(file);
  });
}

function providerIcon(providerKind: GatewayProviderKind): string {
  if (providerKind === 'codex') return codexIcon;
  if (providerKind === 'claude') return claudeIcon;
  if (providerKind === 'vertex') return vertexIcon;
  if (providerKind === 'openai-compatible') return openaiIcon;
  if (providerKind === 'ampcode') return ampcdIcon;
  return geminiIcon;
}

function providerLabel(providerKind: GatewayProviderKind): string {
  if (providerKind === 'codex') return 'Codex';
  if (providerKind === 'claude') return 'Claude';
  if (providerKind === 'vertex') return 'Vertex';
  if (providerKind === 'openai-compatible') return 'OpenAI';
  if (providerKind === 'ampcode') return 'Ampcode';
  return 'Gemini';
}

function formatStatus(status: GatewayAuthFile['status']): string {
  return statusMetadata[status].label;
}

function inferProviderKind(fileName: string): GatewayProviderKind {
  const normalized = fileName.toLowerCase();
  if (normalized.includes('codex')) return 'codex';
  if (normalized.includes('claude')) return 'claude';
  if (normalized.includes('vertex')) return 'vertex';
  if (normalized.includes('openai') || normalized.includes('chatgpt')) return 'openai-compatible';
  if (normalized.includes('ampcode')) return 'ampcode';
  if (normalized.includes('gemini')) return 'gemini';
  return 'gemini';
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知更新';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function readMetadataValue(
  metadata: Record<string, GatewayConfigValue> | null,
  keys: string[]
): GatewayConfigValue | undefined {
  if (!metadata) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(metadata, key)) {
      return metadata[key];
    }
  }
  return undefined;
}

function readMetadataText(metadata: Record<string, GatewayConfigValue> | null, keys: string[]): string {
  const value = readMetadataValue(metadata, keys);
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function readMetadataBoolean(metadata: Record<string, GatewayConfigValue> | null, keys: string[]): boolean {
  const value = readMetadataValue(metadata, keys);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return false;
  return ['true', '1', 'yes', 'y', 'on'].includes(value.trim().toLowerCase());
}

function readMetadataNumber(metadata: Record<string, GatewayConfigValue> | null, keys: string[]): number | undefined {
  const value = readMetadataValue(metadata, keys);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function summarizeMetadata(metadata: Record<string, GatewayConfigValue> | null): Array<{ key: string; value: string }> {
  if (!metadata) return [];
  const hiddenKeys = new Set(['statusMessage', 'status_message', 'disabled', 'runtimeOnly', 'runtime_only']);
  return Object.entries(metadata)
    .filter(([key]) => !hiddenKeys.has(key))
    .slice(0, 6)
    .map(([key, value]) => ({ key, value: formatMetadataValue(value) }));
}

function formatMetadataValue(value: GatewayConfigValue): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function formatFileSize(sizeBytes: number | undefined): string {
  if (!sizeBytes || sizeBytes <= 0) return '-';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}
