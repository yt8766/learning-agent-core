import type { GatewayDashboardSummaryResponse } from '@agent/core';

interface DashboardPageProps {
  summary: GatewayDashboardSummaryResponse;
}

export function DashboardPage({ summary }: DashboardPageProps) {
  return (
    <section className="page-stack" aria-label="Dashboard">
      <div className="section-heading">
        <h2>Dashboard</h2>
        <p>{summary.connection.apiBase ?? 'Local deterministic management client'}</p>
      </div>

      <div className="metric-grid">
        <article className="metric-card">
          <strong>{summary.counts.managementApiKeys} API Keys</strong>
          <span>Management credentials</span>
        </article>
        <article className="metric-card">
          <strong>{summary.counts.authFiles} Auth Files</strong>
          <span>Managed auth records</span>
        </article>
        <article className="metric-card">
          <strong>{summary.counts.providerCredentials} Provider Keys</strong>
          <span>Configured upstream credentials</span>
        </article>
        <article className="metric-card">
          <strong>{summary.counts.availableModels} Models</strong>
          <span>Available model routes</span>
        </article>
      </div>

      <div className="detail-panel">
        <p>Connection: {summary.connection.status}</p>
        <p>Version: {summary.connection.serverVersion ?? '-'}</p>
        <p>Routing: {summary.routing.strategy}</p>
      </div>
    </section>
  );
}
