import { X } from 'lucide-react';
import type { GatewayAuthFile, GatewayAuthFileModelListResponse, GatewayConfigValue } from '@agent/core';

export interface AuthFileModelsModalState {
  open: boolean;
  authFileName: string;
  authFileId: string;
  loading: boolean;
  error: string | null;
  models: GatewayAuthFileModelListResponse['models'];
  onClose: () => void;
}

type AuthFileModelsModalProps = AuthFileModelsModalState;

export function AuthFileModelsModal({
  open,
  authFileName,
  authFileId,
  loading,
  error,
  models,
  onClose
}: AuthFileModelsModalProps) {
  if (!open) return null;
  const availableCount = models.filter(model => model.available).length;
  const aliasCount = models.reduce((total, model) => total + (model.aliases?.length ?? 0), 0);

  return (
    <div className="management-modal-overlay" role="dialog" aria-modal="true" aria-label={`模型列表 - ${authFileName}`}>
      <div className="management-modal card-modal">
        <header className="management-modal-header">
          <div>
            <h2>模型列举</h2>
            <p>
              {authFileName}
              {authFileId ? `（${authFileId}）` : ''}
            </p>
          </div>
          <button onClick={onClose} type="button" aria-label="关闭">
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        {loading ? <div className="management-status muted">正在拉取该文件支持的模型列表…</div> : null}
        {error ? <div className="management-status error">{error}</div> : null}
        {!loading && !error ? (
          models.length === 0 ? (
            <div className="management-empty">
              <h3>该认证文件当前无可用模型</h3>
              <p>该凭证可能尚未被网关加载，或后端模型列举接口暂未返回数据。</p>
            </div>
          ) : (
            <>
              <div className="management-status muted">
                共 {models.length} 个模型 · 可用 {availableCount} 个 · 别名 {aliasCount} 个
              </div>
              <div className="auth-model-list">
                {models.map(model => (
                  <article className="auth-model-item" key={`${model.providerKind}-${model.id}`}>
                    <h3>{model.displayName || model.id}</h3>
                    <p>ID：{model.id}</p>
                    <p>
                      提供商：{model.providerKind} · {model.available ? '可用' : '不可用'}
                    </p>
                    {model.aliases && model.aliases.length > 0 ? <small>别名：{model.aliases.join('、')}</small> : null}
                  </article>
                ))}
              </div>
            </>
          )
        ) : null}
      </div>
    </div>
  );
}

export interface AuthFilePatchFieldsModalProps {
  open: boolean;
  authFileName: string;
  authFileId: string;
  accountEmail: string;
  disabled: boolean;
  headersText: string;
  providerId: string;
  projectId: string;
  note: string;
  prefix: string;
  priority: string;
  proxyUrl: string;
  metadataText: string;
  authStatus: GatewayAuthFile['status'];
  statusText: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  onChangeField: (
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
  ) => void;
}

export function AuthFilePatchFieldsModal({
  accountEmail,
  authStatus,
  disabled,
  authFileId,
  authFileName,
  error,
  headersText,
  metadataText,
  note,
  onChangeField,
  onClose,
  onSubmit,
  prefix,
  priority,
  projectId,
  proxyUrl,
  providerId,
  saving,
  statusText,
  open
}: AuthFilePatchFieldsModalProps) {
  if (!open) return null;

  return (
    <div className="management-modal-overlay" role="dialog" aria-modal="true" aria-label={`字段修补 - ${authFileName}`}>
      <form
        className="management-modal card-modal"
        onSubmit={event => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <header className="management-modal-header">
          <div>
            <h2>字段修补</h2>
            <p>
              {authFileName}
              {authFileId ? `（${authFileId}）` : ''}
            </p>
          </div>
          <button onClick={onClose} type="button" aria-label="关闭">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="provider-config-field">
          <span>启用状态</span>
          <label className="provider-config-inline-option">
            <input
              checked={!disabled}
              onChange={event => onChangeField('disabled', !event.currentTarget.checked)}
              type="checkbox"
            />
            启用该认证文件
          </label>
        </div>

        <label className="provider-config-field">
          <span>providerId</span>
          <input
            autoComplete="off"
            value={providerId}
            onChange={event => onChangeField('providerId', event.currentTarget.value)}
            placeholder="例如 gemini、claude"
          />
        </label>

        <label className="provider-config-field">
          <span>accountEmail</span>
          <input
            autoComplete="off"
            value={accountEmail}
            onChange={event => onChangeField('accountEmail', event.currentTarget.value)}
            placeholder="例如 user@example.com"
          />
        </label>

        <label className="provider-config-field">
          <span>projectId</span>
          <input
            autoComplete="off"
            value={projectId}
            onChange={event => onChangeField('projectId', event.currentTarget.value)}
            placeholder="例如 project-xxxx"
          />
        </label>

        <label className="provider-config-field">
          <span>status</span>
          <select value={authStatus} onChange={event => onChangeField('authStatus', event.currentTarget.value)}>
            <option value="valid">有效</option>
            <option value="invalid">异常</option>
            <option value="missing">缺失</option>
            <option value="expired">过期</option>
          </select>
        </label>

        <label className="provider-config-field">
          <span>prefix</span>
          <input
            autoComplete="off"
            value={prefix}
            onChange={event => onChangeField('prefix', event.currentTarget.value)}
            placeholder="例如 /v1 或自定义路径前缀"
          />
        </label>

        <label className="provider-config-field">
          <span>proxyUrl</span>
          <input
            autoComplete="off"
            value={proxyUrl}
            onChange={event => onChangeField('proxyUrl', event.currentTarget.value)}
            placeholder="例如 socks5://127.0.0.1:1080"
          />
        </label>

        <label className="provider-config-field">
          <span>priority</span>
          <input
            autoComplete="off"
            inputMode="numeric"
            value={priority}
            onChange={event => onChangeField('priority', event.currentTarget.value)}
            placeholder="整数，留空表示不修改"
          />
        </label>

        <label className="provider-config-field">
          <span>note</span>
          <textarea
            rows={3}
            value={note}
            onChange={event => onChangeField('note', event.currentTarget.value)}
            placeholder="给该认证文件添加备注"
          />
        </label>

        <label className="provider-config-field">
          <span>headers（JSON）</span>
          <textarea
            rows={5}
            value={headersText}
            onChange={event => onChangeField('headersText', event.currentTarget.value)}
            placeholder='例如 {"X-Provider":"agent-gateway"}'
          />
        </label>

        <label className="provider-config-field">
          <span>metadata（JSON）</span>
          <textarea
            rows={8}
            value={metadataText}
            onChange={event => onChangeField('metadataText', event.currentTarget.value)}
            placeholder='例如 {"region":"us-central1","touchedBy":"ui"}'
          />
        </label>

        {error ? <div className="management-status error">{error}</div> : null}
        {statusText ? <div className="management-status muted">{statusText}</div> : null}

        <div className="management-modal-footer">
          <button disabled={saving} type="button" onClick={onClose}>
            取消
          </button>
          <button className="save-action" disabled={saving} type="submit">
            {saving ? '保存中' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function parseAuthFileMetadata(text: string): Record<string, GatewayConfigValue> | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return {};
  }
  const parsed = JSON.parse(trimmed);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('metadata 必须是 JSON 对象。');
  }
  return parsed as Record<string, GatewayConfigValue>;
}

export function parseAuthFileHeaders(text: string): Record<string, string> | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return {};
  }
  const parsed = JSON.parse(trimmed);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('headers 必须是 JSON 对象。');
  }
  const headers: Record<string, string> = {};
  Object.entries(parsed).forEach(([key, value]) => {
    if (typeof value !== 'string') {
      throw new Error('headers 的值必须全部是字符串。');
    }
    headers[key] = value;
  });
  return headers;
}
