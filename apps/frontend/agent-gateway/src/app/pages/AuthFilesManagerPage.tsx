const batchActions = ['Batch upload', 'Batch download', 'Batch delete'];
const recordActions = ['Status toggle', 'Field patch', 'Model listing'];
const browseModes = ['Filter', 'Search', 'Pagination', 'Compact', 'List diagram'];

interface AuthFilesManagerPageProps {
  onBatchUpload?: () => void;
  onBatchDownload?: () => void;
  onBatchDelete?: () => void;
  onToggleStatus?: () => void;
  onPatchFields?: () => void;
  onListModels?: () => void;
}

export function AuthFilesManagerPage({
  onBatchDelete,
  onBatchDownload,
  onBatchUpload,
  onListModels,
  onPatchFields,
  onToggleStatus
}: AuthFilesManagerPageProps) {
  const batchHandlers: Record<string, (() => void) | undefined> = {
    'Batch upload': onBatchUpload,
    'Batch download': onBatchDownload,
    'Batch delete': onBatchDelete
  };
  const recordHandlers: Record<string, (() => void) | undefined> = {
    'Status toggle': onToggleStatus,
    'Field patch': onPatchFields,
    'Model listing': onListModels
  };

  return (
    <section className="page-stack" aria-label="Auth Files Manager">
      <div className="section-heading">
        <h2>Auth Files Manager</h2>
        <p>认证文件治理入口只处理文件元数据、状态与模型索引，不把密钥正文放入前端状态。</p>
      </div>

      <div className="metric-grid">
        <article className="command-panel">
          <div className="section-heading">
            <h3>Batch operations</h3>
            <p>批量上传、下载与删除认证文件，执行前进入确认流。</p>
          </div>
          <div className="command-actions">
            {batchActions.map(action => (
              <button key={action} type="button" onClick={batchHandlers[action]}>
                {action}
              </button>
            ))}
          </div>
        </article>

        <article className="command-panel">
          <div className="section-heading">
            <h3>Record patching</h3>
            <p>针对单个文件执行状态开关、字段补丁和可用模型列举。</p>
          </div>
          <div className="command-actions">
            {recordActions.map(action => (
              <button key={action} type="button" onClick={recordHandlers[action]}>
                {action}
              </button>
            ))}
          </div>
        </article>

        <article className="command-panel">
          <div className="section-heading">
            <h3>Browse controls</h3>
            <p>面向大量认证文件的筛选、搜索、分页、紧凑视图与列表关系图。</p>
          </div>
          <div className="command-actions">
            {browseModes.map(action => (
              <button key={action} type="button">
                {action}
              </button>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
