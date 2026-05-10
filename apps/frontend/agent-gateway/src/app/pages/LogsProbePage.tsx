import type { GatewayLogListResponse, GatewayUsageListResponse } from '@agent/core';
import { GatewayTable } from '../components/GatewayTable';
import { formatGatewayDate } from '../gateway-view-model';

interface LogsProbePageProps {
  logs: GatewayLogListResponse;
  usage: GatewayUsageListResponse;
}

export function LogsProbePage({ logs, usage }: LogsProbePageProps) {
  return (
    <section className="page-stack" aria-label="日志与探测">
      <div className="section-heading">
        <h2>日志与探测</h2>
        <p>探测动作会在写操作阶段接线；这里先固定日志、用量和调用边界。</p>
      </div>
      <div className="probe-panel">
        <label>
          Provider ID
          <input placeholder="openai-primary" readOnly />
        </label>
        <label>
          Prompt
          <input placeholder="ping" readOnly />
        </label>
        <button type="button" disabled>
          探测
        </button>
      </div>
      <GatewayTable
        emptyText="暂无请求日志"
        getRowKey={log => log.id}
        items={logs.items}
        columns={[
          { key: 'occurredAt', header: '时间', render: log => formatGatewayDate(log.occurredAt) },
          {
            key: 'level',
            header: '级别',
            render: log => <span className={`status-pill log-${log.level}`}>{log.level}</span>
          },
          { key: 'stage', header: '阶段', render: log => log.stage },
          { key: 'provider', header: 'Provider', render: log => log.provider },
          { key: 'message', header: '消息', render: log => log.message },
          { key: 'tokens', header: 'Token', render: log => `${log.inputTokens} / ${log.outputTokens}` }
        ]}
      />
      <GatewayTable
        emptyText="暂无用量记录"
        getRowKey={record => record.id}
        items={usage.items}
        columns={[
          { key: 'date', header: '日期', render: record => record.date },
          { key: 'provider', header: 'Provider', render: record => record.provider },
          { key: 'requestCount', header: '请求', render: record => record.requestCount },
          { key: 'tokens', header: 'Token', render: record => `${record.inputTokens} / ${record.outputTokens}` },
          { key: 'cost', header: '估算成本', render: record => `$${record.estimatedCostUsd.toFixed(4)}` }
        ]}
      />
    </section>
  );
}
