interface LogsManagerPageProps {
  confirmClearLabel?: string;
  lastMessage?: string | null;
  onClearLogs?: () => void;
  onDownloadErrorLogFile?: () => void;
  onDownloadRequestById?: () => void;
  onSetParsedView?: () => void;
  onSetRawView?: () => void;
}

export function LogsManagerPage({
  confirmClearLabel = '清空日志',
  lastMessage = null,
  onClearLogs,
  onDownloadErrorLogFile,
  onDownloadRequestById,
  onSetParsedView,
  onSetRawView
}: LogsManagerPageProps) {
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
          <button type="button">开始 Tail</button>
          <button type="button" onClick={onDownloadRequestById}>
            Download request by id
          </button>
          <button type="button" onClick={onDownloadErrorLogFile}>
            Download error log file
          </button>
          <button type="button" onClick={onSetRawView}>
            Raw view
          </button>
          <button type="button" onClick={onSetParsedView}>
            Parsed view
          </button>
          <button type="button" className="danger-action" onClick={onClearLogs}>
            {confirmClearLabel}
          </button>
          <button type="button">下载错误日志</button>
        </div>
        {lastMessage ? <p>{lastMessage}</p> : null}
      </div>
    </section>
  );
}
