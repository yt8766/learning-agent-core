import type { GatewayQuota } from '@agent/core';
import type { FormEvent } from 'react';
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
  onRefreshProviderQuota?: (providerKind: string) => void;
  onUpdateQuota?: (quota: GatewayQuota) => void;
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
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!firstQuota) return;
    const form = new FormData(event.currentTarget);
    const limitTokens = Number(form.get('limitTokens') ?? firstQuota.limitTokens);
    onUpdateQuota?.({
      ...firstQuota,
      limitTokens: Number.isFinite(limitTokens) ? limitTokens : firstQuota.limitTokens
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
          <button
            type="button"
            onClick={() => quotaSections.forEach(section => onRefreshProviderQuota?.(section.type))}
          >
            <RefreshCw size={16} aria-hidden="true" />
            刷新全部
          </button>
        </div>
      </div>

      <div className="quota-section-stack">
        {quotaSections.map(section => (
          <article className={`quota-section-card ${section.accent}`} key={section.id}>
            <header className="quota-section-header">
              <div className="auth-panel-title">
                <img className="quota-section-icon" src={section.icon} alt="" />
                <span>{section.title}</span>
                <strong>{section.id === firstQuota?.provider ? 1 : 0}</strong>
              </div>
              <div className="quota-section-actions">
                <span className="quota-view-toggle">
                  <button className="active" type="button">
                    分页模式
                  </button>
                  <button type="button">全部显示</button>
                </span>
                <button type="button" onClick={() => onRefreshProviderQuota?.(section.type)}>
                  <RefreshCw size={15} aria-hidden="true" />
                  刷新全部
                </button>
              </div>
            </header>

            <div className="quota-card-grid">
              <article className="quota-file-card">
                <div className="auth-file-badges">
                  <span>{section.type}</span>
                  <strong className={section.id === firstQuota?.provider ? '' : 'muted'}>
                    {section.id === firstQuota?.provider ? 'READY' : 'IDLE'}
                  </strong>
                </div>
                <h3>{section.id === firstQuota?.provider ? firstQuota.id : `${section.id}-auth-file.json`}</h3>
                <p>
                  {section.id === firstQuota?.provider
                    ? `${firstQuota.usedTokens} / ${firstQuota.limitTokens} tokens`
                    : '点击刷新读取额度'}
                </p>
                <div className="quota-progress-track">
                  <span
                    style={{ width: `${section.id === firstQuota?.provider ? quotaUsagePercent(firstQuota) : 0}%` }}
                  />
                </div>
                <small>
                  {section.id === firstQuota?.provider
                    ? `重置：${formatGatewayDate(firstQuota.resetAt)}`
                    : '暂无缓存额度'}
                </small>
              </article>
            </div>
          </article>
        ))}
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

      <form className="command-panel quota-edit-panel" onSubmit={handleSubmit}>
        <label>
          策略 ID
          <input name="quotaId" defaultValue={firstQuota?.id ?? ''} />
        </label>
        <label>
          Token 上限
          <input name="limitTokens" defaultValue={firstQuota?.limitTokens ?? ''} type="number" />
        </label>
        <div className="command-actions">
          <button type="submit">保存配额</button>
          <button type="button">取消</button>
          <button type="button" className="danger-action">
            删除
          </button>
        </div>
      </form>
    </section>
  );
}
