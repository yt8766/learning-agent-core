import type {
  GatewayAuthFile,
  GatewayAuthFileBatchUploadRequest,
  GatewayAuthFileModelListResponse,
  GatewayQuotaDetail,
  GatewayProviderKind
} from '@agent/core';
import type { Dispatch, SetStateAction } from 'react';
import type { AuthFileItem } from '@/types';

export type AuthFilesSortMode = 'default' | 'az' | 'priority';

export const AUTH_FILES_SORT_OPTIONS: Array<{ value: AuthFilesSortMode; label: string }> = [
  { value: 'default', label: '默认' },
  { value: 'az', label: '名称' },
  { value: 'priority', label: '优先级' }
];

export interface AuthFileModelsModalState {
  fileName: string;
  fileType: string;
  loading: boolean;
  models: Array<{ id: string; display_name?: string; type?: string; owned_by?: string }>;
  open: boolean;
}

export type ListAuthFileModels = (authFileId: string) => Promise<unknown> | void;

export function toAuthFileItem(file: GatewayAuthFile, quotaDetails: GatewayQuotaDetail[] = []): AuthFileItem {
  const providerQuotaDetails = quotaDetails.filter(
    detail => detail.providerId === file.providerId || detail.providerId === file.id
  );
  return {
    ...file.metadata,
    id: file.id,
    name: file.fileName,
    type: toAuthFileType(file.providerKind, file.providerId, file.fileName),
    provider: file.providerId,
    size: file.sizeBytes,
    authIndex: file.authIndex,
    disabled: file.disabled,
    failed: file.failedCount,
    lastRefresh: file.updatedAt,
    modified: Date.parse(file.updatedAt),
    note: file.note,
    prefix: file.prefix,
    priority: file.priority,
    proxyUrl: file.proxyUrl,
    status: file.status,
    statusMessage: file.statusMessage,
    success: file.successCount,
    quotaDetails: providerQuotaDetails
  };
}

export async function showAuthFileModels(
  authFile: AuthFileItem,
  sourceFiles: GatewayAuthFile[],
  onListModels: ListAuthFileModels | undefined,
  setModelsModal: Dispatch<SetStateAction<AuthFileModelsModalState>>,
  setStatus: Dispatch<SetStateAction<string>>
) {
  setModelsModal({
    fileName: authFile.name,
    fileType: String(authFile.type ?? ''),
    loading: true,
    models: [],
    open: true
  });
  try {
    const source = sourceFiles.find(file => file.fileName === authFile.name || file.id === authFile.id);
    const response = (await onListModels?.(source?.id ?? authFile.name)) as
      | GatewayAuthFileModelListResponse
      | undefined;
    setModelsModal(current => ({
      ...current,
      loading: false,
      models: (response?.models ?? []).map(model => ({
        id: model.id,
        display_name: model.displayName,
        type: model.providerKind
      }))
    }));
  } catch (error) {
    setStatus(`模型列举失败：${error instanceof Error ? error.message : '操作失败'}`);
    setModelsModal(current => ({ ...current, loading: false }));
  }
}

export async function readUploadFiles(files: FileList | null): Promise<GatewayAuthFileBatchUploadRequest['files']> {
  if (!files) return [];
  return Promise.all(
    Array.from(files).map(async file => ({
      fileName: file.name,
      contentBase64: await fileToBase64(file),
      providerKind: inferProviderKind(file.name)
    }))
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'));
    reader.onload = () => resolve(String(reader.result ?? '').split(',')[1] ?? '');
    reader.readAsDataURL(file);
  });
}

function inferProviderKind(fileName: string): GatewayProviderKind | undefined {
  const lowerName = normalizeAuthFileProviderKey(fileName);
  if (lowerName.includes('gemini')) return 'gemini';
  if (lowerName.includes('codex')) return 'codex';
  if (lowerName.includes('claude')) return 'claude';
  if (lowerName.includes('vertex')) return 'vertex';
  if (lowerName.includes('openai')) return 'openai-compatible';
  if (lowerName.includes('amp')) return 'ampcode';
  return undefined;
}

function toAuthFileType(providerKind: GatewayProviderKind, providerId: string, fileName: string): AuthFileItem['type'] {
  const providerKey = normalizeAuthFileProviderKey(`${providerId} ${fileName}`);
  if (providerKey.includes('antigravity')) return 'antigravity';
  if (providerKey.includes('gemini-cli') || providerKey.includes('gemini_cli')) return 'gemini-cli';
  if (providerKey.includes('kimi')) return 'kimi';
  if (providerKey.includes('qwen')) return 'qwen';
  if (providerKey.includes('iflow')) return 'iflow';
  if (providerKey.includes('aistudio') || providerKey.includes('ai-studio')) return 'aistudio';
  if (providerKind === 'openai-compatible' || providerKind === 'custom') return 'unknown';
  return providerKind;
}

function normalizeAuthFileProviderKey(value: string): string {
  return value.trim().toLowerCase();
}
