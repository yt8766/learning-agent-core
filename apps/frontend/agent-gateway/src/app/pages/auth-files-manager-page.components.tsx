import { AlertCircle, Download, FileJson, GitBranch, Info, Trash2 } from 'lucide-react';
import { useId } from 'react';
import type { GatewayAuthFilePatchRequest } from '@agent/core';
import {
  batchActions,
  browseModes,
  isBrowseModeActive,
  recordActions,
  type AuthFileListItem
} from './auth-files-manager-page.model';

interface AuthFileGridProps {
  busyAction: string | null;
  compactMode: boolean;
  filesLength: number;
  hasSelection: boolean;
  onBatchDownload?: (authFileIds: string[]) => Promise<unknown> | void;
  onDeleteFiles?: (fileNames: string[]) => Promise<unknown> | void;
  onListModels?: (authFileId: string) => Promise<unknown> | unknown;
  onPatchFields?: (
    authFileId: string,
    patch?: Omit<GatewayAuthFilePatchRequest, 'authFileId'>
  ) => Promise<unknown> | unknown;
  onResetFilters: () => void;
  onSelectFile: (fileId: string, selected: boolean) => void;
  onToggleStatus?: (authFileId: string, nextDisabled?: boolean) => Promise<unknown> | void;
  onUploadEmpty: () => void;
  runOperation: (label: string, operation?: () => Promise<unknown> | unknown) => Promise<void>;
  selectedFileIds: Set<string>;
  visibleFiles: AuthFileListItem[];
  onSelectPage: (selected: boolean) => void;
  relationView: boolean;
}

export function AuthFileGrid({
  busyAction,
  compactMode,
  filesLength,
  hasSelection,
  onBatchDownload,
  onDeleteFiles,
  onListModels,
  onPatchFields,
  onResetFilters,
  onSelectFile,
  onSelectPage,
  onToggleStatus,
  onUploadEmpty,
  runOperation,
  selectedFileIds,
  visibleFiles,
  relationView
}: AuthFileGridProps) {
  const sectionId = useId();
  const selectableVisibleFiles = visibleFiles.filter(file => !file.runtimeOnly);
  const allVisibleSelected =
    selectableVisibleFiles.length > 0 && selectableVisibleFiles.every(file => selectedFileIds.has(file.id));

  return (
    <div className="auth-file-grid">
      {visibleFiles.length === 0 ? (
        <button
          className="provider-empty-state auth-empty-state auth-empty-upload"
          onClick={filesLength === 0 ? onUploadEmpty : onResetFilters}
          type="button"
        >
          <span className="provider-empty-icon">
            <FileJson size={28} aria-hidden="true" />
          </span>
          <div>
            <h3>暂无认证文件</h3>
            <p>{filesLength === 0 ? '点击批量上传导入 OAuth 或服务账号 JSON。' : '点击重置筛选条件。'}</p>
          </div>
        </button>
      ) : (
        <>
          <label className="auth-file-select-all" htmlFor={sectionId}>
            <input
              checked={allVisibleSelected}
              disabled={selectableVisibleFiles.length === 0}
              id={sectionId}
              onChange={event => onSelectPage(event.currentTarget.checked)}
              type="checkbox"
            />
            全选当前页
          </label>
          {visibleFiles.map(file => {
            const checkboxId = `${sectionId}-${file.id}`;
            const isSelected = selectedFileIds.has(file.id);

            return (
              <article className={`auth-file-card${compactMode ? ' compact' : ''}`} key={file.id}>
                <div className="auth-file-card-main">
                  <label className="auth-file-select" htmlFor={checkboxId}>
                    <input
                      checked={isSelected}
                      disabled={file.runtimeOnly}
                      id={checkboxId}
                      onChange={event => onSelectFile(file.id, event.currentTarget.checked)}
                      type="checkbox"
                    />
                    <span>{file.runtimeOnly ? '虚拟' : '选择'}</span>
                  </label>
                  <span className="auth-file-avatar">
                    <img src={file.icon} alt="" />
                  </span>
                  <div>
                    <div className="auth-file-badges">
                      <span>{file.provider}</span>
                      <strong className={`status-${file.statusTone}`}>{file.statusLabel}</strong>
                      {file.runtimeOnly ? <strong className="status-neutral">运行时</strong> : null}
                    </div>
                    <h3>{file.name}</h3>
                    <p>{file.fileName}</p>
                    <small>{`${file.models} · ${file.detail} · 更新 ${file.updatedAtLabel}`}</small>
                    {file.note ? <small>{`备注：${file.note}`}</small> : null}
                  </div>
                </div>
                <div className="provider-credential-row">
                  <span>路径：{file.filePath}</span>
                  <span>Provider ID：{file.providerId || '-'}</span>
                  <span>Project：{file.projectId || '-'}</span>
                  <span>Account：{file.accountEmail || '-'}</span>
                </div>
                <div className="provider-credential-row">
                  <span>大小：{file.sizeLabel || '-'}</span>
                  <span>优先级：{file.priority ?? '-'}</span>
                  <span>Auth Index：{file.authIndex || '-'}</span>
                  <span>
                    成功 / 失败：{file.successCount ?? 0} / {file.failedCount ?? 0}
                  </span>
                </div>
                <div className="provider-credential-row">
                  <span>Prefix：{file.prefix || '-'}</span>
                  <span>Proxy URL：{file.proxyUrl || '-'}</span>
                  <span>Headers：{file.headers ? Object.keys(file.headers).length : 0}</span>
                </div>
                {file.statusMessage ? (
                  <div className="management-status error">
                    <AlertCircle size={14} aria-hidden="true" />
                    {file.statusMessage}
                  </div>
                ) : null}
                {file.metadataEntries && file.metadataEntries.length > 0 ? (
                  <div className="provider-credential-row">
                    {file.metadataEntries.map(entry => (
                      <span key={`${file.id}-${entry.key}`}>
                        {entry.key}：{entry.value}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="auth-card-actions">
                  <button
                    aria-label={`下载 ${file.fileName}`}
                    disabled={busyAction === `下载:${file.id}`}
                    type="button"
                    onClick={() =>
                      void runOperation(
                        `下载:${file.id}`,
                        onBatchDownload ? async () => onBatchDownload([file.id]) : undefined
                      )
                    }
                  >
                    <Download size={15} aria-hidden="true" />
                    {busyAction === `下载:${file.id}` ? '下载中' : '下载'}
                  </button>
                  <button
                    disabled={busyAction === `模型列举:${file.id}`}
                    type="button"
                    onClick={() =>
                      void runOperation(`模型列举:${file.id}`, onListModels ? () => onListModels(file.id) : undefined)
                    }
                  >
                    {busyAction === `模型列举:${file.id}` ? '列举中' : '模型列举'}
                  </button>
                  <button
                    disabled={busyAction === `状态切换:${file.id}`}
                    type="button"
                    onClick={() =>
                      void runOperation(
                        `状态切换:${file.id}`,
                        onToggleStatus ? () => onToggleStatus(file.id, !file.disabled) : undefined
                      )
                    }
                  >
                    {busyAction === `状态切换:${file.id}` ? '切换中' : file.disabled ? '启用' : '停用'}
                  </button>
                  <button
                    disabled={busyAction === `字段修补:${file.id}`}
                    type="button"
                    onClick={() =>
                      void runOperation(`字段修补:${file.id}`, onPatchFields ? () => onPatchFields(file.id) : undefined)
                    }
                  >
                    {busyAction === `字段修补:${file.id}` ? '修补中' : '字段修补'}
                  </button>
                  <button
                    disabled={busyAction === `删除:${file.id}` || file.runtimeOnly}
                    type="button"
                    onClick={() =>
                      void runOperation(
                        `删除:${file.id}`,
                        onDeleteFiles ? () => onDeleteFiles([file.fileName]) : undefined
                      )
                    }
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    {busyAction === `删除:${file.id}` ? '删除中' : '删除'}
                  </button>
                </div>
              </article>
            );
          })}
          {relationView ? (
            <div className="auth-relation-panel">
              <strong>
                <GitBranch size={15} aria-hidden="true" />
                关系视图
              </strong>
              {visibleFiles.map(file => (
                <p key={`relation-${file.id}`}>
                  {file.relationLabel || `${file.provider} → ${file.fileName}`} · {file.models} 个模型
                </p>
              ))}
            </div>
          ) : null}
        </>
      )}
      <p className="provider-credential-row" style={{ marginTop: '0.5rem' }}>
        已选 {selectedFileIds.size} 项（仅限当前列表）
        {selectedFileIds.size > 0 && hasSelection ? null : null}
        <Info size={14} aria-hidden="true" />
      </p>
    </div>
  );
}

interface AuthOperationStripProps {
  batchHandlers: Record<string, () => void>;
  busyAction: string | null;
  compactMode: boolean;
  hasSelection: boolean;
  handleBrowseMode: (action: string) => void;
  recordHandlers: Record<string, () => void>;
  relationView: boolean;
}

export function AuthOperationStrip({
  batchHandlers,
  busyAction,
  compactMode,
  hasSelection,
  handleBrowseMode,
  recordHandlers,
  relationView
}: AuthOperationStripProps) {
  return (
    <div className="auth-operation-strip">
      {batchActions.map(action => (
        <button
          disabled={
            busyAction === action ||
            (!hasSelection && ['批量下载', '批量删除', '批量状态切换', '取消选择'].includes(action))
          }
          key={action}
          type="button"
          onClick={batchHandlers[action]}
        >
          {busyAction === action ? `${action}中` : action}
        </button>
      ))}
      {recordActions.map(action => (
        <button disabled={busyAction === action} key={action} type="button" onClick={recordHandlers[action]}>
          {busyAction === action ? `${action}中` : action}
        </button>
      ))}
      {browseModes.map(action => (
        <button
          aria-pressed={isBrowseModeActive(action, compactMode, relationView)}
          key={action}
          type="button"
          onClick={() => handleBrowseMode(action)}
        >
          {action}
        </button>
      ))}
    </div>
  );
}
