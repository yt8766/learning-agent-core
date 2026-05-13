import { ArrowDownToLine, CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { GatewayMigrationApplyResponse, GatewayMigrationPreview } from '../../api/agent-gateway-api';
import type { GatewayMigrationApplyRequest, GatewayMigrationPreviewRequest } from '../../api/agent-gateway-api';

interface MigrationPageProps {
  initialApiBase?: string;
  initialApplyResult?: GatewayMigrationApplyResponse | null;
  initialManagementKey?: string;
  initialPreview?: GatewayMigrationPreview | null;
  onApply?: (request: GatewayMigrationApplyRequest) => Promise<GatewayMigrationApplyResponse>;
  onPreview?: (request: GatewayMigrationPreviewRequest) => Promise<GatewayMigrationPreview>;
}

export function MigrationPage({
  initialApiBase = '',
  initialApplyResult = null,
  initialManagementKey = '',
  initialPreview = null,
  onApply,
  onPreview
}: MigrationPageProps) {
  const [apiBase, setApiBase] = useState(initialApiBase);
  const [managementKey, setManagementKey] = useState(initialManagementKey);
  const [preview, setPreview] = useState<GatewayMigrationPreview | null>(initialPreview);
  const [applyResult, setApplyResult] = useState<GatewayMigrationApplyResponse | null>(initialApplyResult);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [confirmUnsafeConflicts, setConfirmUnsafeConflicts] = useState(false);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedSafeIds = useMemo(
    () =>
      preview?.resources
        .filter(resource => resource.safe && selectedSourceIds.has(resource.sourceId))
        .map(resource => resource.sourceId) ?? [],
    [preview, selectedSourceIds]
  );

  const handlePreview = async (): Promise<void> => {
    if (!apiBase.trim() || !managementKey.trim()) {
      setError('请输入 CLIProxyAPI 地址和 Management Key。');
      return;
    }
    if (!onPreview) {
      setError('迁移 API 尚未接入，无法预览。');
      return;
    }
    setBusy('preview');
    setError(null);
    setApplyResult(null);
    try {
      const result = await onPreview({ apiBase: apiBase.trim(), managementKey: managementKey.trim() });
      setPreview(result);
      setSelectedSourceIds(
        new Set(result.resources.filter(resource => resource.safe).map(resource => resource.sourceId))
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '预览失败');
    } finally {
      setBusy(null);
    }
  };

  const handleApply = async (): Promise<void> => {
    if (!preview) {
      setError('请先预览迁移资源。');
      return;
    }
    if (!onApply) {
      setError('迁移 API 尚未接入，无法导入。');
      return;
    }
    setBusy('apply');
    setError(null);
    try {
      setApplyResult(
        await onApply(
          createMigrationApplyRequest(
            apiBase,
            managementKey,
            selectedSafeIds,
            selectedSourceIds,
            confirmUnsafeConflicts
          )
        )
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '导入失败');
    } finally {
      setBusy(null);
    }
  };

  const toggleResource = (sourceId: string): void => {
    setSelectedSourceIds(current => {
      const next = new Set(current);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  };

  return (
    <section className="gateway-management-page" aria-label="CLIProxyAPI 迁移">
      <div className="management-page-header">
        <div>
          <p className="eyebrow">Migration</p>
          <h1 className="management-page-title">CLIProxyAPI 迁移</h1>
          <p className="management-page-subtitle">从既有管理面读取配置、认证文件、配额与日志元数据。</p>
        </div>
        <button className="primary-action" disabled={busy !== null} onClick={() => void handlePreview()} type="button">
          <RefreshCw size={16} aria-hidden="true" />
          {busy === 'preview' ? '预览中' : '预览迁移'}
        </button>
      </div>

      <article className="system-section-card">
        <div className="form-grid">
          <label>
            <span>CLIProxyAPI 地址</span>
            <input
              autoComplete="url"
              onChange={event => setApiBase(event.target.value)}
              placeholder="https://router.example.com"
              type="url"
              value={apiBase}
            />
          </label>
          <label>
            <span>Management Key</span>
            <input
              autoComplete="off"
              onChange={event => setManagementKey(event.target.value)}
              placeholder="mgmt_..."
              type="password"
              value={managementKey}
            />
          </label>
        </div>
      </article>

      {error ? <div className="error-panel">{error}</div> : null}

      {preview ? (
        <article className="system-section-card">
          <header>
            <h2>迁移预览</h2>
            <span className="status-pill status-ready">{preview.source.serverVersion ?? 'unknown'}</span>
          </header>
          <div className="metric-strip">
            <span>Create {preview.totals.create}</span>
            <span>Update {preview.totals.update}</span>
            <span>Skip {preview.totals.skip}</span>
            <span>Conflict {preview.totals.conflict}</span>
          </div>
          <div className="system-model-list">
            {preview.resources.map(resource => (
              <label className="system-model-row" key={`${resource.kind}:${resource.sourceId}`}>
                <input
                  checked={selectedSourceIds.has(resource.sourceId)}
                  disabled={!resource.safe && !confirmUnsafeConflicts}
                  onChange={() => toggleResource(resource.sourceId)}
                  type="checkbox"
                />
                <div>
                  <span className="system-model-title">
                    <strong>{resource.summary}</strong>
                  </span>
                  <small>
                    {resource.kind} / {resource.sourceId}
                  </small>
                </div>
                <span className={`status-pill status-${resource.safe ? 'ready' : 'degraded'}`}>{resource.action}</span>
              </label>
            ))}
          </div>
          {preview.conflicts.length > 0 ? (
            <div className="conflict-list">
              {preview.conflicts.map(conflict => (
                <div className="conflict-row" key={`${conflict.kind}:${conflict.sourceId}`}>
                  <ShieldAlert size={16} aria-hidden="true" />
                  <span>{conflict.reason}</span>
                </div>
              ))}
              <label className="inline-check">
                <input
                  checked={confirmUnsafeConflicts}
                  onChange={event => setConfirmUnsafeConflicts(event.target.checked)}
                  type="checkbox"
                />
                <span>确认导入冲突资源</span>
              </label>
            </div>
          ) : null}
          <button
            className="primary-action"
            disabled={selectedSourceIds.size === 0 || busy !== null}
            onClick={() => void handleApply()}
            type="button"
          >
            <ArrowDownToLine size={16} aria-hidden="true" />
            {busy === 'apply' ? '导入中' : '执行导入'}
          </button>
        </article>
      ) : null}

      {applyResult ? (
        <article className="system-section-card">
          <header>
            <h2>导入结果</h2>
            <CheckCircle2 size={18} aria-hidden="true" />
          </header>
          <strong>
            Imported {applyResult.imported.length} / Skipped {applyResult.skipped.length} / Failed{' '}
            {applyResult.failed.length}
          </strong>
          <small>{applyResult.migrationId}</small>
          <div className="metric-strip">
            <span>Imported {applyResult.imported.length}</span>
            <span>Skipped {applyResult.skipped.length}</span>
            <span>Failed {applyResult.failed.length}</span>
            <span>Warnings {applyResult.warnings.length}</span>
          </div>
          {applyResult.warnings.length > 0 ? (
            <div className="conflict-list">
              {applyResult.warnings.map(warning => (
                <div className="conflict-row" key={warning}>
                  <ShieldAlert size={16} aria-hidden="true" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          ) : null}
          {applyResult.failed.length > 0 ? (
            <div className="conflict-list">
              {applyResult.failed.map(failure => (
                <div className="conflict-row" key={`${failure.kind}:${failure.sourceId}`}>
                  <ShieldAlert size={16} aria-hidden="true" />
                  <span>
                    {failure.kind} / {failure.sourceId}: {failure.reason}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}

export function createMigrationApplyRequest(
  apiBase: string,
  managementKey: string,
  selectedSafeIds: string[],
  selectedSourceIds: Set<string>,
  confirmUnsafeConflicts: boolean
): GatewayMigrationApplyRequest {
  return {
    apiBase,
    managementKey,
    selectedSourceIds: confirmUnsafeConflicts ? [...selectedSourceIds] : selectedSafeIds,
    confirmUnsafeConflicts
  };
}
