import { useState } from 'react';
import type { GatewayLogListResponse } from '@agent/core';

interface LogsManagerPageProps {
  confirmClearLabel?: string;
  logs?: GatewayLogListResponse;
  lastMessage?: string | null;
  onClearLogs?: () => Promise<unknown> | void;
  onDownloadErrorLogFile?: () => Promise<unknown> | void;
  onDownloadRequestById?: () => Promise<unknown> | void;
  onSetParsedView?: () => void;
  onSetRawView?: () => void;
}

type LogsOperationState = {
  status: 'idle' | 'running' | 'success' | 'error';
  message: string;
};

export async function runLogsOperation({
  callback,
  label,
  setOperation
}: {
  callback: (() => Promise<unknown> | void) | undefined;
  label: string;
  setOperation: (operation: LogsOperationState) => void;
}): Promise<void> {
  if (!callback) {
    setOperation({ status: 'error', message: `${label} 未接入 AgentGatewayApiClient` });
    return;
  }
  setOperation({ status: 'running', message: `${label}中` });
  try {
    await callback();
    setOperation({ status: 'success', message: `${label}完成` });
  } catch (error) {
    const message = error instanceof Error ? error.message : `${label}失败`;
    setOperation({ status: 'error', message });
  }
}

export function LogsManagerPage({
  confirmClearLabel = '清空日志',
  logs = { items: [] },
  lastMessage = null,
  onClearLogs,
  onDownloadErrorLogFile,
  onDownloadRequestById,
  onSetParsedView,
  onSetRawView
}: LogsManagerPageProps) {
  const [operation, setOperation] = useState<LogsOperationState>({
    status: 'idle',
    message: lastMessage ?? '等待操作'
  });

  return (
    <section className="page-stack" aria-label="Logs Manager">
      <div className="section-heading">
        <h2>Logs Manager</h2>
        <p>搜索、tail、清理和下载 CLI Proxy request logs。</p>
      </div>
      <div className="command-panel">
        <input aria-label="搜索日志" placeholder="搜索日志" />
        <label className="inline-check">
          <input type="checkbox" />
          隐藏管理流量
        </label>
        <select name="method" defaultValue="">
          <option value="">All methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
        <select name="status" defaultValue="">
          <option value="">All status</option>
          <option value="2xx">2xx</option>
          <option value="4xx">4xx</option>
          <option value="5xx">5xx</option>
        </select>
        <div className="command-actions">
          <button
            type="button"
            disabled={operation.status === 'running'}
            onClick={() => {
              setOperation({ status: 'error', message: '开始 Tail 未接入 AgentGatewayApiClient' });
            }}
          >
            开始 Tail
          </button>
          <button
            type="button"
            disabled={operation.status === 'running'}
            onClick={() => void runLogsOperation({ callback: onDownloadRequestById, label: '下载请求', setOperation })}
          >
            Download request by id
          </button>
          <button
            type="button"
            aria-label="Download error log file"
            disabled={operation.status === 'running'}
            onClick={() =>
              void runLogsOperation({ callback: onDownloadErrorLogFile, label: '下载错误日志', setOperation })
            }
          >
            下载错误日志
          </button>
          <button
            type="button"
            onClick={() => {
              onSetRawView?.();
              setOperation({ status: 'success', message: '已切换 Raw view' });
            }}
          >
            Raw view
          </button>
          <button
            type="button"
            onClick={() => {
              onSetParsedView?.();
              setOperation({ status: 'success', message: '已切换 Parsed view' });
            }}
          >
            Parsed view
          </button>
          <button
            type="button"
            className="danger-action"
            disabled={operation.status === 'running'}
            onClick={() => void runLogsOperation({ callback: onClearLogs, label: confirmClearLabel, setOperation })}
          >
            {confirmClearLabel}
          </button>
        </div>
        <p role="status" className={`operation-status status-${operation.status}`}>
          {operation.message}
        </p>
        <p>当前日志 {logs.items.length} 条</p>
      </div>
    </section>
  );
}
