import { Activity, Clock3, RadioTower, ServerCog } from 'lucide-react';
import type { GatewayRuntimeHealthResponse } from '@agent/core';
import { formatGatewayDate } from '../gateway-view-model';

interface RuntimeEnginePageProps {
  health: GatewayRuntimeHealthResponse | null;
}

export function RuntimeEnginePage({ health }: RuntimeEnginePageProps) {
  if (!health) return <div className="loading-panel">正在加载 Runtime Engine...</div>;

  return (
    <section className="gateway-management-page runtime-engine-page" aria-label="Runtime Engine">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Execution Kernel</p>
          <h1>Runtime Engine</h1>
        </div>
        <span className={`status-pill status-${health.status}`}>{health.status}</span>
      </div>

      <div className="runtime-summary-grid">
        <article className="runtime-summary-tile">
          <span className="runtime-summary-icon">
            <ServerCog size={18} aria-hidden="true" />
          </span>
          <div>
            <span>整体状态</span>
            <strong>{health.status}</strong>
          </div>
        </article>
        <article className="runtime-summary-tile">
          <span className="runtime-summary-icon">
            <Activity size={18} aria-hidden="true" />
          </span>
          <div>
            <span>Active Requests</span>
            <strong>{health.activeRequests}</strong>
          </div>
        </article>
        <article className="runtime-summary-tile">
          <span className="runtime-summary-icon">
            <RadioTower size={18} aria-hidden="true" />
          </span>
          <div>
            <span>Active Streams</span>
            <strong>{health.activeStreams}</strong>
          </div>
        </article>
        <article className="runtime-summary-tile">
          <span className="runtime-summary-icon">
            <Clock3 size={18} aria-hidden="true" />
          </span>
          <div>
            <span>Checked</span>
            <strong>{formatGatewayDate(health.checkedAt)}</strong>
          </div>
        </article>
      </div>

      <div className="metric-strip">
        <span>Queue {health.usageQueue.pending}</span>
        <span>Failed {health.usageQueue.failed}</span>
        <span>Cooldowns {health.cooldowns.length}</span>
        <span>Streaming Executors {health.executors.filter(executor => executor.supportsStreaming).length}</span>
      </div>

      <div className="gateway-table runtime-engine-table">
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Status</th>
              <th>Streaming</th>
              <th>Active</th>
              <th>Checked</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {health.executors.length === 0 ? (
              <tr>
                <td colSpan={6}>暂无 executor</td>
              </tr>
            ) : (
              health.executors.map(executor => (
                <tr key={executor.providerKind}>
                  <td>{executor.providerKind}</td>
                  <td>
                    <span className={`status-pill status-${executor.status}`}>{executor.status}</span>
                  </td>
                  <td>{executor.supportsStreaming ? 'yes' : 'no'}</td>
                  <td>{executor.activeRequests}</td>
                  <td>{formatGatewayDate(executor.checkedAt)}</td>
                  <td>{executor.message ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
