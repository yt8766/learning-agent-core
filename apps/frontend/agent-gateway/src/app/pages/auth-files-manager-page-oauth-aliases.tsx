import { AlertCircle, Plus, Save, Trash2, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import {
  GatewayOAuthModelAliasListResponseSchema,
  type GatewayOAuthModelAliasRule,
  type GatewayUpdateOAuthModelAliasRulesRequest
} from '@agent/core';
import { getErrorMessage } from './auth-files-manager-page.model';
import { type AuthFileListItem } from './auth-files-manager-page.model';

interface AuthFileOAuthAliasPanelProps {
  files: AuthFileListItem[];
  onLoadOAuthAliases?: (providerId: string) => Promise<unknown> | void;
  onSaveOAuthAliases?: (
    providerId: string,
    request: GatewayUpdateOAuthModelAliasRulesRequest
  ) => Promise<unknown> | void;
}

interface ProviderAliasCard {
  providerId: string;
  providerName: string;
  count: number;
}

interface AliasOperationStatus {
  kind: 'idle' | 'loading' | 'success' | 'error';
  message: string;
}

interface AliasDraftRow {
  id: number;
  channel: string;
  sourceModel: string;
  alias: string;
  fork: boolean;
}

interface OAuthAliasModalState {
  open: boolean;
  providerId: string;
  providerName: string;
  aliases: AliasDraftRow[];
  updatedAt: string;
  saving: boolean;
  loading: boolean;
  error: string | null;
  status: AliasOperationStatus;
}

const initialModalState: OAuthAliasModalState = {
  aliases: [],
  error: null,
  loading: false,
  open: false,
  providerId: '',
  providerName: '',
  saving: false,
  status: {
    kind: 'idle',
    message: '等待操作。'
  },
  updatedAt: ''
};

export function AuthFilesOAuthAliasPanel({
  files,
  onLoadOAuthAliases,
  onSaveOAuthAliases
}: AuthFileOAuthAliasPanelProps) {
  const rowIdRef = useRef(0);
  const [status, setStatus] = useState<AliasOperationStatus>({
    kind: 'idle',
    message: '当前认证文件已聚合到按 Provider 的模型别名管理。'
  });
  const [modalState, setModalState] = useState<OAuthAliasModalState>(initialModalState);

  const aliasProviderCards = useMemo(() => {
    const map = new Map<string, ProviderAliasCard>();
    files.forEach(file => {
      const providerId = file.providerId.trim();
      if (!providerId) {
        return;
      }
      const item = map.get(providerId);
      if (item) {
        item.count += 1;
        return;
      }
      map.set(providerId, {
        providerId,
        providerName: file.provider,
        count: 1
      });
    });
    return Array.from(map.values()).sort((left, right) => left.providerName.localeCompare(right.providerName));
  }, [files]);

  const newDraftRow = (): AliasDraftRow => {
    const next = rowIdRef.current + 1;
    rowIdRef.current = next;
    return {
      id: next,
      channel: '',
      sourceModel: '',
      alias: '',
      fork: false
    };
  };

  const openAliasEditor = async (providerId: string): Promise<void> => {
    const providerName =
      aliasProviderCards.find(provider => provider.providerId === providerId)?.providerName ?? providerId;

    setModalState(current => ({
      ...current,
      aliases: [],
      error: null,
      loading: true,
      open: true,
      providerId,
      providerName,
      saving: false,
      status: {
        kind: 'loading',
        message: `正在加载 ${providerName} 的模型别名规则…`
      },
      updatedAt: ''
    }));
    setStatus({
      kind: 'loading',
      message: `正在加载 ${providerName} 的模型别名。`
    });

    try {
      if (!onLoadOAuthAliases) {
        throw new Error('当前页面尚未接入 OAuth 模型别名加载回调。');
      }
      const response = await onLoadOAuthAliases(providerId);
      const parsed = parseOAuthModelAliasListResponse(response, providerId);
      setModalState(current => ({
        ...current,
        aliases: parsed.modelAliases.map(rule => ({
          ...rule,
          id: nextRowId(rowIdRef)
        })),
        loading: false,
        status: {
          kind: 'success',
          message: `已加载 ${parsed.modelAliases.length} 条模型别名规则。`
        },
        updatedAt: parsed.updatedAt
      }));
      setStatus({
        kind: 'success',
        message: `已加载 ${providerName} 的模型别名，共 ${parsed.modelAliases.length} 条。`
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setModalState(current => ({
        ...current,
        aliases: [],
        loading: false,
        error: message,
        status: {
          kind: 'error',
          message: `模型别名加载失败：${message}`
        }
      }));
      setStatus({
        kind: 'error',
        message: `模型别名加载失败：${message}`
      });
      throw error;
    }
  };

  const closeModal = (): void => {
    setModalState(initialModalState);
  };

  const handleAliasFieldChange = (id: number, field: 'channel' | 'sourceModel' | 'alias', value: string): void => {
    setModalState(current => ({
      ...current,
      error: null,
      aliases: current.aliases.map(row => (row.id === id ? { ...row, [field]: value } : row))
    }));
  };

  const handleForkChange = (id: number, checked: boolean): void => {
    setModalState(current => ({
      ...current,
      error: null,
      aliases: current.aliases.map(row => (row.id === id ? { ...row, fork: checked } : row))
    }));
  };

  const removeAliasRow = (id: number): void => {
    setModalState(current => ({
      ...current,
      aliases: current.aliases.filter(row => row.id !== id),
      error: null
    }));
  };

  const appendAliasRow = (): void => {
    setModalState(current => ({
      ...current,
      aliases: [...current.aliases, newDraftRow()],
      error: null,
      status: {
        kind: 'idle',
        message: '已添加空白规则，请填写后保存。'
      }
    }));
  };

  const saveAliases = async (): Promise<void> => {
    if (modalState.saving) {
      return;
    }
    if (!onSaveOAuthAliases) {
      setModalState(current => ({
        ...current,
        error: '当前页面尚未接入 OAuth 模型别名保存回调。',
        status: {
          kind: 'error',
          message: '当前页面尚未接入 OAuth 模型别名保存回调。'
        }
      }));
      return;
    }
    try {
      const modelAliases = modalState.aliases.map(rule => ({
        channel: rule.channel.trim(),
        sourceModel: rule.sourceModel.trim(),
        alias: rule.alias.trim(),
        fork: rule.fork
      }));

      if (modelAliases.length > 0) {
        const invalidIndex = modelAliases.findIndex(rule => !rule.channel || !rule.sourceModel || !rule.alias);
        if (invalidIndex !== -1) {
          const position = invalidIndex + 1;
          const message = `第 ${position} 条规则缺少 channel / sourceModel / alias。`;
          setModalState(current => ({
            ...current,
            error: message,
            status: {
              kind: 'error',
              message
            }
          }));
          return;
        }
      }

      setModalState(current => ({
        ...current,
        error: null,
        saving: true,
        status: {
          kind: 'loading',
          message: '正在保存模型别名规则…'
        }
      }));
      setStatus({
        kind: 'loading',
        message: `正在保存 ${modalState.providerName} 的模型别名规则…`
      });

      const response = await onSaveOAuthAliases(modalState.providerId, {
        providerId: modalState.providerId,
        modelAliases
      });
      const parsed = parseOAuthModelAliasListResponse(response, modalState.providerId);
      setModalState(current => ({
        ...current,
        aliases: parsed.modelAliases.map(rule => ({
          ...rule,
          id: nextRowId(rowIdRef)
        })),
        error: null,
        saving: false,
        status: {
          kind: 'success',
          message: `已保存 ${parsed.modelAliases.length} 条规则，更新于 ${parsed.updatedAt}`
        },
        updatedAt: parsed.updatedAt
      }));
      setStatus({
        kind: 'success',
        message: `${modalState.providerName} 已保存 ${parsed.modelAliases.length} 条模型别名规则。`
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setModalState(current => ({
        ...current,
        saving: false,
        error: message,
        status: {
          kind: 'error',
          message: `保存失败：${message}`
        }
      }));
      setStatus({
        kind: 'error',
        message: `保存失败：${message}`
      });
      throw error;
    }
  };

  return (
    <article className="auth-oauth-alias-panel">
      <header className="auth-oauth-alias-header">
        <div>
          <h2>OAuth 模型别名</h2>
          <p>按 providerId 管理模型别名映射规则，支持添加、编辑、删除与保存。</p>
        </div>
        <span className={`auth-oauth-alias-status ${status.kind}`}>{status.message}</span>
      </header>
      <div className="auth-oauth-alias-grid">
        {aliasProviderCards.length === 0 ? (
          <div className="provider-empty-state">
            <span className="provider-empty-icon">
              <AlertCircle size={24} aria-hidden="true" />
            </span>
            <div>
              <h3>暂无可配置的 OAuth Provider</h3>
              <p>先补齐认证文件列表后即可维护对应别名规则。</p>
            </div>
          </div>
        ) : (
          aliasProviderCards.map(provider => (
            <article className="auth-oauth-alias-provider-card" key={`${provider.providerId}`}>
              <div>
                <strong>{provider.providerName || provider.providerId}</strong>
                <p>providerId: {provider.providerId}</p>
                <small>采集文件：{provider.count} 个</small>
              </div>
              <button
                onClick={() => {
                  void openAliasEditor(provider.providerId);
                }}
                type="button"
              >
                编辑别名
              </button>
            </article>
          ))
        )}
      </div>

      {modalState.open ? (
        <div className="auth-modal-backdrop" role="dialog" aria-modal="true" aria-label="OAuth 模型别名规则">
          <div className="auth-modal-card wide">
            <header className="auth-modal-header">
              <div>
                <h2>OAuth 模型别名规则</h2>
                <p>
                  {modalState.providerName || modalState.providerId}
                  {modalState.updatedAt ? ` · 最近更新 ${modalState.updatedAt}` : ''}
                </p>
              </div>
              <button className="auth-modal-close" onClick={closeModal} type="button" aria-label="关闭">
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <section className="auth-modal-body">
              <div className={`auth-modal-feedback ${modalState.status.kind}`}>{modalState.status.message}</div>

              {modalState.loading ? (
                <div className="auth-modal-feedback loading">正在加载 provider 的别名规则…</div>
              ) : null}

              {modalState.error ? <div className="auth-modal-feedback error">{modalState.error}</div> : null}

              <div className="auth-oauth-alias-editor">
                <div className="auth-oauth-alias-editor-head">
                  <button onClick={appendAliasRow} type="button">
                    <Plus size={14} aria-hidden="true" />
                    新增规则
                  </button>
                </div>
                <div className="auth-oauth-alias-grid-head">
                  <span>channel</span>
                  <span>sourceModel</span>
                  <span>alias</span>
                  <span>fork</span>
                  <span>操作</span>
                </div>
                <div className="auth-oauth-alias-grid-body">
                  {modalState.aliases.map(row => (
                    <div className="auth-oauth-alias-row" key={row.id}>
                      <input
                        autoComplete="off"
                        onChange={event => handleAliasFieldChange(row.id, 'channel', event.currentTarget.value)}
                        placeholder="如 openai、gemini"
                        value={row.channel}
                      />
                      <input
                        autoComplete="off"
                        onChange={event => handleAliasFieldChange(row.id, 'sourceModel', event.currentTarget.value)}
                        placeholder="如 gpt-4o"
                        value={row.sourceModel}
                      />
                      <input
                        autoComplete="off"
                        onChange={event => handleAliasFieldChange(row.id, 'alias', event.currentTarget.value)}
                        placeholder="如 gpt-4o-mini"
                        value={row.alias}
                      />
                      <label className="auth-oauth-alias-fork">
                        <input
                          checked={row.fork}
                          onChange={event => handleForkChange(row.id, event.currentTarget.checked)}
                          type="checkbox"
                        />
                        启用
                      </label>
                      <button onClick={() => removeAliasRow(row.id)} type="button">
                        <Trash2 size={14} aria-hidden="true" />
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <div className="auth-modal-actions">
              <button disabled={modalState.saving} onClick={closeModal} type="button">
                取消
              </button>
              <button
                className="primary-action"
                disabled={modalState.saving}
                onClick={() => {
                  void saveAliases();
                }}
                type="button"
              >
                {modalState.saving ? (
                  <>
                    <Save size={14} aria-hidden="true" />
                    保存中
                  </>
                ) : (
                  '保存'
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function parseOAuthModelAliasListResponse(
  response: unknown,
  requestedProviderId: string
): {
  providerId: string;
  modelAliases: GatewayOAuthModelAliasRule[];
  updatedAt: string;
} {
  const parsed = GatewayOAuthModelAliasListResponseSchema.safeParse(response);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(issue ? issue.message : 'OAuth 模型别名响应格式不合法。');
  }

  return {
    providerId: parsed.data.providerId || requestedProviderId,
    modelAliases: parsed.data.modelAliases,
    updatedAt: parsed.data.updatedAt
  };
}

function nextRowId(rowIdRef: { current: number }): number {
  const next = rowIdRef.current + 1;
  rowIdRef.current = next;
  return next;
}
