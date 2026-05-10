import type {
  GatewayClient,
  GatewayClientApiKeyListResponse,
  GatewayClientQuota,
  GatewayClientRequestLogListResponse
} from '@agent/core';
import type { FormEvent } from 'react';
import { KeyRound, Power, RefreshCw, UserPlus } from 'lucide-react';
import { GatewayTable } from '../components/GatewayTable';
import { formatGatewayDate } from '../gateway-view-model';

interface ClientsPageProps {
  apiKeysByClient?: Record<string, GatewayClientApiKeyListResponse>;
  clients: GatewayClient[];
  logsByClient?: Record<string, GatewayClientRequestLogListResponse>;
  onCreateApiKey?: (clientId: string) => void;
  onCreateClient?: (request: { name: string; ownerEmail?: string }) => void;
  onToggleClient?: (client: GatewayClient) => void;
  onUpdateQuota?: (clientId: string, request: { tokenLimit: number; requestLimit: number; resetAt: string }) => void;
  quotasByClient?: Record<string, GatewayClientQuota>;
}

export function ClientsPage({
  apiKeysByClient = {},
  clients,
  logsByClient = {},
  onCreateApiKey,
  onCreateClient,
  onToggleClient,
  onUpdateQuota,
  quotasByClient = {}
}: ClientsPageProps) {
  const firstClient = clients[0];
  const firstQuota = firstClient ? quotasByClient[firstClient.id] : null;

  const handleCreateClient = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const ownerEmail = String(form.get('ownerEmail') ?? '').trim();
    if (!name) return;
    onCreateClient?.({ name, ownerEmail: ownerEmail || undefined });
  };

  const handleQuotaSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!firstClient || !firstQuota) return;
    const form = new FormData(event.currentTarget);
    const tokenLimit = Number(form.get('tokenLimit') ?? firstQuota.tokenLimit);
    const requestLimit = Number(form.get('requestLimit') ?? firstQuota.requestLimit);
    onUpdateQuota?.(firstClient.id, {
      tokenLimit: Number.isFinite(tokenLimit) ? tokenLimit : firstQuota.tokenLimit,
      requestLimit: Number.isFinite(requestLimit) ? requestLimit : firstQuota.requestLimit,
      resetAt: firstQuota.resetAt
    });
  };

  return (
    <section className="client-management-page gateway-management-page" aria-label="调用方管理">
      <div className="auth-files-header">
        <div>
          <h1 className="management-page-title">调用方管理</h1>
          <p>为每个接入方配置独立 API key、月度额度、用量和请求日志，运行时直接调用 /v1/*。</p>
        </div>
        <form className="client-create-form" onSubmit={handleCreateClient}>
          <input aria-label="调用方名称" name="name" placeholder="调用方名称" />
          <input aria-label="Owner Email" name="ownerEmail" placeholder="owner@example.com" type="email" />
          <button type="submit">
            <UserPlus size={15} aria-hidden="true" />
            新建调用方
          </button>
        </form>
      </div>

      <div className="client-card-grid">
        {clients.map(client => {
          const quota = quotasByClient[client.id];
          const keyCount = apiKeysByClient[client.id]?.items.length ?? 0;
          const logCount = logsByClient[client.id]?.items.length ?? 0;
          return (
            <article className="client-runtime-card" key={client.id}>
              <header>
                <div>
                  <span className={`status-pill quota-${quota?.status ?? 'normal'}`}>{client.status}</span>
                  <h2>{client.name}</h2>
                  <p>{client.ownerEmail ?? client.id}</p>
                </div>
                <button type="button" onClick={() => onToggleClient?.(client)}>
                  <Power size={15} aria-hidden="true" />
                  {client.status === 'active' ? '停用' : '启用'}
                </button>
              </header>
              <dl className="client-runtime-metrics">
                <div>
                  <dt>Token</dt>
                  <dd>
                    {(quota?.usedTokens ?? 0).toLocaleString()} / {(quota?.tokenLimit ?? 0).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt>Requests</dt>
                  <dd>
                    {(quota?.usedRequests ?? 0).toLocaleString()} / {(quota?.requestLimit ?? 0).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt>API Keys</dt>
                  <dd>{keyCount}</dd>
                </div>
                <div>
                  <dt>Logs</dt>
                  <dd>{logCount}</dd>
                </div>
              </dl>
              <div className="quota-progress-track">
                <span style={{ width: `${quotaPercent(quota)}%` }} />
              </div>
              <button type="button" onClick={() => onCreateApiKey?.(client.id)}>
                <KeyRound size={15} aria-hidden="true" />
                生成 API Key
              </button>
            </article>
          );
        })}
      </div>

      <GatewayTable
        emptyText="暂无调用方"
        getRowKey={client => client.id}
        items={clients}
        columns={[
          { key: 'name', header: '调用方', render: client => client.name },
          { key: 'status', header: '状态', render: client => client.status },
          {
            key: 'quota',
            header: '额度',
            render: client => {
              const quota = quotasByClient[client.id];
              return quota ? `${quota.usedTokens} / ${quota.tokenLimit} tokens` : '默认额度待加载';
            }
          },
          {
            key: 'keys',
            header: '密钥',
            render: client => `${apiKeysByClient[client.id]?.items.length ?? 0} 个`
          },
          {
            key: 'updatedAt',
            header: '更新时间',
            render: client => formatGatewayDate(client.updatedAt)
          }
        ]}
      />

      <form className="command-panel quota-edit-panel client-quota-editor" onSubmit={handleQuotaSubmit}>
        <label>
          调用方
          <input name="clientId" readOnly value={firstClient?.id ?? ''} />
        </label>
        <label>
          Token 上限
          <input name="tokenLimit" defaultValue={firstQuota?.tokenLimit ?? ''} type="number" />
        </label>
        <label>
          Request 上限
          <input name="requestLimit" defaultValue={firstQuota?.requestLimit ?? ''} type="number" />
        </label>
        <div className="command-actions">
          <button type="submit">保存调用方额度</button>
          <button type="button" onClick={() => firstClient && onCreateApiKey?.(firstClient.id)}>
            <RefreshCw size={15} aria-hidden="true" />
            生成密钥
          </button>
        </div>
      </form>
    </section>
  );
}

function quotaPercent(quota: GatewayClientQuota | undefined): number {
  if (!quota) return 0;
  return Math.min(100, Math.round((quota.usedTokens / quota.tokenLimit) * 100));
}
