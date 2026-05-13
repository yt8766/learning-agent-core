import type { GatewayQuota } from '@agent/core';
import { useRef, useState, type FormEvent } from 'react';
import { RefreshCw } from 'lucide-react';
import antigravityIcon from '../assets/provider-icons/antigravity.svg';
import claudeIcon from '../assets/provider-icons/claude.svg';
import codexIcon from '../assets/provider-icons/codex.svg';
import geminiIcon from '../assets/provider-icons/gemini.svg';
import kimiIcon from '../assets/provider-icons/kimi-light.svg';
import { GatewayTable } from '../components/GatewayTable';
import { formatGatewayDate, quotaUsagePercent } from '../gateway-view-model';

interface QuotasPageProps {
  quotas: GatewayQuota[];
  onRefreshProviderQuota?: (providerKind: string) => Promise<unknown> | void;
  onUpdateQuota?: (quota: GatewayQuota) => Promise<unknown> | void;
}

const quotaSections = [
  { id: 'claude', title: 'Claude 配额', icon: claudeIcon, type: 'claude', accent: 'claude' },
  { id: 'antigravity', title: 'Antigravity 配额', icon: antigravityIcon, type: 'antigravity', accent: 'antigravity' },
  { id: 'codex', title: 'Codex 配额', icon: codexIcon, type: 'codex', accent: 'codex' },
  { id: 'gemini-cli', title: 'Gemini CLI 配额', icon: geminiIcon, type: 'gemini-cli', accent: 'gemini' },
  { id: 'kimi', title: 'Kimi 配额', icon: kimiIcon, type: 'kimi', accent: 'kimi' }
];

export function QuotasPage({ onRefreshProviderQuota, onUpdateQuota, quotas }: QuotasPageProps) {
  const firstQuota = quotas[0];
  const formRef = useRef<HTMLFormElement>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [operationStatus, setOperationStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const runOperation = async (label: string, operation: () => Promise<unknown> | unknown): Promise<void> => {
    setBusyAction(label);
    setOperationStatus(null);
    try {
      const result = await operation();
      if (result === undefined) {
        throw new Error('当前页面尚未接入该操作');
      }
      setOperationStatus({ kind: 'success', message: `${label}已完成。` });
    } catch (error) {
      setOperationStatus({ kind: 'error', message: `${label}失败：${getErrorMessage(error)}` });
    } finally {
      setBusyAction(null);
    }
  };

  const refreshProviderQuota = (providerKind: string): void => {
    void runOperation(`刷新 ${providerKind} 配额`, async () => onRefreshProviderQuota?.(providerKind));
  };

  const handleRefreshAll = (): void => {
    void runOperation('刷新全部配额', async () =>
      Promise.all(quotaSections.map(section => onRefreshProviderQuota?.(section.type)))
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quotaId = String(form.get('quotaId') ?? '');
    const quota = quotas.find(item => item.id === quotaId) ?? firstQuota;
    if (!quota) return;
    const limitTokens = Number(form.get('limitTokens') ?? quota.limitTokens);
    void runOperation('保存配额', async () =>
      onUpdateQuota?.({
        ...quota,
        limitTokens: Number.isFinite(limitTokens) ? limitTokens : quota.limitTokens
      })
    );
  };

  const resetForm = (): void => {
    formRef.current?.reset();
    setOperationStatus({ kind: 'success', message: '表单已重置。' });
  };

  const setSectionExpanded = (sectionId: string, expanded: boolean): void => {
    setExpandedSections(current => {
      const next = new Set(current);
      if (expanded) next.add(sectionId);
      else next.delete(sectionId);
      return next;
    });
  };

  return (
    <section className="quota-management-clone gateway-management-page" aria-label="配额管理">
      <div className="auth-files-header">
        <div>
          <h1 className="management-page-title">配额管理</h1>
          <p>按 provider 分段查看认证文件额度，保留参考项目的分页/全部显示、刷新全部和 quota card 布局。</p>
        </div>
        <div className="quota-header-actions">
          <span>{quotas.length} 条策略</span>
          <button disabled={busyAction === '刷新全部配额'} type="button" onClick={handleRefreshAll}>
            <RefreshCw size={16} aria-hidden="true" />
            {busyAction === '刷新全部配额' ? '刷新中' : '刷新全部'}
          </button>
        </div>
      </div>

      {operationStatus ? (
        <div className={`operation-feedback ${operationStatus.kind}`}>{operationStatus.message}</div>
      ) : null}

      <div className="quota-section-stack">
        {quotaSections.map(section => {
          const sectionQuotas = quotas.filter(quota => quotaMatchesSection(quota, section.id));
          const expanded = expandedSections.has(section.id);
          const visibleQuotas = expanded ? sectionQuotas : sectionQuotas.slice(0, 4);
          return (
            <article className={`quota-section-card ${section.accent}`} key={section.id}>
              <header className="quota-section-header">
                <div className="auth-panel-title">
                  <img className="quota-section-icon" src={section.icon} alt="" />
                  <span>{section.title}</span>
                  <strong>{sectionQuotas.length}</strong>
                </div>
                <div className="quota-section-actions">
                  <span className="quota-view-toggle">
                    <button
                      className={expanded ? '' : 'active'}
                      type="button"
                      onClick={() => setSectionExpanded(section.id, false)}
                    >
                      分页模式
                    </button>
                    <button
                      className={expanded ? 'active' : ''}
                      type="button"
                      onClick={() => setSectionExpanded(section.id, true)}
                    >
                      全部显示
                    </button>
                  </span>
                  <button
                    disabled={busyAction === `刷新 ${section.type} 配额`}
                    type="button"
                    onClick={() => refreshProviderQuota(section.type)}
                  >
                    <RefreshCw size={15} aria-hidden="true" />
                    {busyAction === `刷新 ${section.type} 配额` ? '刷新中' : '刷新全部'}
                  </button>
                </div>
              </header>

              <div className="quota-card-grid">
                {sectionQuotas.length > 0 ? (
                  visibleQuotas.map(quota => <QuotaFileCard key={quota.id} quota={quota} sectionType={section.type} />)
                ) : (
                  <button
                    className="quota-file-card quota-empty-action"
                    type="button"
                    onClick={() => refreshProviderQuota(section.type)}
                  >
                    <div className="auth-file-badges">
                      <span>{section.type}</span>
                      <strong className="muted">IDLE</strong>
                    </div>
                    <h3>{section.id}-auth-file.json</h3>
                    <p>点击刷新读取额度</p>
                    <div className="quota-progress-track">
                      <span style={{ width: '0%' }} />
                    </div>
                    <small>暂无缓存额度</small>
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <GatewayTable
        emptyText="暂无配额策略"
        getRowKey={quota => quota.id}
        items={quotas}
        columns={[
          { key: 'id', header: '策略 ID', render: quota => quota.id },
          { key: 'provider', header: '供应商', render: quota => quota.provider },
          { key: 'scope', header: 'Scope', render: quota => quota.scope },
          {
            key: 'usage',
            header: '使用量',
            render: quota => (
              <span>
                {quota.usedTokens.toLocaleString()} / {quota.limitTokens.toLocaleString()} tokens (
                {quotaUsagePercent(quota)}%)
              </span>
            )
          },
          {
            key: 'status',
            header: '状态',
            render: quota => <span className={`status-pill quota-${quota.status}`}>{quota.status}</span>
          },
          { key: 'resetAt', header: '重置时间', render: quota => formatGatewayDate(quota.resetAt) }
        ]}
      />

      <form className="command-panel quota-edit-panel" onSubmit={handleSubmit} ref={formRef}>
        <label>
          策略 ID
          <input name="quotaId" defaultValue={firstQuota?.id ?? ''} />
        </label>
        <label>
          Token 上限
          <input name="limitTokens" defaultValue={firstQuota?.limitTokens ?? ''} type="number" />
        </label>
        <div className="command-actions">
          <button disabled={busyAction === '保存配额'} type="submit">
            {busyAction === '保存配额' ? '保存中' : '保存配额'}
          </button>
          <button type="button" onClick={resetForm}>
            重置表单
          </button>
        </div>
      </form>
    </section>
  );
}

function QuotaFileCard({ quota, sectionType }: { quota: GatewayQuota; sectionType: string }) {
  return (
    <article className="quota-file-card">
      <div className="auth-file-badges">
        <span>{sectionType}</span>
        <strong>{quota.status.toUpperCase()}</strong>
      </div>
      <h3>{quota.id}</h3>
      <p>
        {quota.usedTokens} / {quota.limitTokens} tokens
      </p>
      <div className="quota-progress-track">
        <span style={{ width: `${quotaUsagePercent(quota)}%` }} />
      </div>
      <small>重置：{formatGatewayDate(quota.resetAt)}</small>
    </article>
  );
}

function quotaMatchesSection(quota: GatewayQuota, sectionId: string): boolean {
  const provider = quota.provider.toLowerCase().replaceAll('_', '-').replaceAll(' ', '-');
  if (sectionId === 'gemini-cli') return provider === 'gemini-cli' || provider === 'gemini';
  return provider === sectionId;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '未知错误';
}
