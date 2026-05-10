import type { GatewayQuota } from '@agent/core';
import { GatewayTable } from '../components/GatewayTable';
import { formatGatewayDate, quotaUsagePercent } from '../gateway-view-model';

interface QuotasPageProps {
  quotas: GatewayQuota[];
}

export function QuotasPage({ quotas }: QuotasPageProps) {
  return (
    <section className="page-stack" aria-label="配额">
      <div className="section-heading">
        <h2>配额</h2>
        <p>按 scope 观察 token 消耗、重置时间和风险状态。</p>
      </div>
      <form className="command-panel">
        <label>
          策略 ID
          <input name="quotaId" defaultValue={quotas[0]?.id ?? ''} />
        </label>
        <label>
          Token 上限
          <input name="limitTokens" defaultValue={quotas[0]?.limitTokens ?? ''} type="number" />
        </label>
        <div className="command-actions">
          <button type="submit">保存配额</button>
          <button type="button">取消</button>
          <button type="button" className="danger-action">
            删除
          </button>
        </div>
      </form>
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
    </section>
  );
}
