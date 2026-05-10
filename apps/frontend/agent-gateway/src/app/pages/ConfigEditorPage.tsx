import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';

interface ConfigEditorPageProps {
  content?: string;
  version?: string;
  dirty?: boolean;
  saving?: boolean;
  lastMessage?: string | null;
  onDiff?: () => void;
  onReload?: () => void;
  onSave?: () => void;
}

export function ConfigEditorPage({
  content = '',
  dirty = false,
  lastMessage = null,
  onDiff,
  onReload,
  onSave,
  saving = false,
  version = 'unknown'
}: ConfigEditorPageProps) {
  useUnsavedChangesGuard(dirty);

  return (
    <section className="page-stack" aria-label="config.yaml">
      <div className="section-heading">
        <h2>config.yaml</h2>
        <p>编辑 CLI Proxy API 原始 YAML 配置，保存前可查看差异。</p>
      </div>
      <div className="editor-toolbar">
        <span>Version: {version}</span>
        {dirty ? <span className="status-pill">未保存</span> : null}
        {saving ? <span className="status-pill">保存中</span> : null}
        <button type="button" onClick={onDiff}>
          查看差异
        </button>
        <button type="button" onClick={onSave}>
          保存配置
        </button>
        <button type="button" onClick={onReload}>
          重新加载
        </button>
      </div>
      {lastMessage ? <p>{lastMessage}</p> : null}
      <textarea className="raw-config-editor" defaultValue={content} spellCheck={false} />
    </section>
  );
}
