import type { GatewayProviderCredentialSet } from '@agent/core';
import { GatewayTable } from '../components/GatewayTable';

interface ProvidersPageProps {
  providers: GatewayProviderCredentialSet[];
}

export function ProvidersPage({ providers }: ProvidersPageProps) {
  return (
    <section className="page-stack" aria-label="上游方">
      <div className="section-heading">
        <h2>上游方</h2>
        <p>按 provider credential set 管理上游模型能力、优先级和超时边界。</p>
      </div>
      <form className="command-panel">
        <label>
          Provider ID
          <input name="providerId" defaultValue={providers[0]?.id ?? ''} />
        </label>
        <label>
          Base URL
          <input name="baseUrl" defaultValue={providers[0]?.baseUrl ?? ''} />
        </label>
        <div className="command-actions">
          <button type="submit">保存上游方</button>
          <button type="button">取消</button>
          <button type="button" className="danger-action">
            删除
          </button>
        </div>
      </form>
      <GatewayTable
        emptyText="暂无上游方"
        getRowKey={provider => provider.id}
        items={providers}
        columns={[
          { key: 'id', header: 'Provider ID', render: provider => provider.id },
          { key: 'provider', header: '供应商', render: provider => provider.provider },
          {
            key: 'status',
            header: '状态',
            render: provider => <span className={`status-pill status-${provider.status}`}>{provider.status}</span>
          },
          { key: 'priority', header: '优先级', render: provider => provider.priority },
          { key: 'baseUrl', header: 'Base URL', render: provider => provider.baseUrl },
          { key: 'timeoutMs', header: '超时', render: provider => `${provider.timeoutMs}ms` },
          { key: 'models', header: '模型族', render: provider => provider.modelFamilies.join(', ') }
        ]}
      />
    </section>
  );
}
