import { Code2, GitCompare, RefreshCcw, Save } from 'lucide-react';
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
    <section className="page-stack gateway-management-page" aria-label="config.yaml">
      <div className="config-clone-header">
        <div>
          <span className="page-eyebrow">Configuration Source</span>
          <h2>config.yaml</h2>
          <p>编辑 Agent Gateway 原始 YAML 配置，保存前可查看差异。</p>
        </div>
        <span className="hero-status-pill">
          <Code2 size={16} aria-hidden="true" />
          YAML
        </span>
      </div>
      <div className="editor-toolbar">
        <span>Version: {version}</span>
        {dirty ? <span className="status-pill">未保存</span> : null}
        {saving ? <span className="status-pill">保存中</span> : null}
        <button type="button" onClick={onDiff}>
          <GitCompare size={15} aria-hidden="true" />
          查看差异
        </button>
        <button type="button" onClick={onSave}>
          <Save size={15} aria-hidden="true" />
          保存配置
        </button>
        <button type="button" onClick={onReload}>
          <RefreshCcw size={15} aria-hidden="true" />
          重新加载
        </button>
      </div>
      {lastMessage ? <p>{lastMessage}</p> : null}
      <textarea className="raw-config-editor" defaultValue={content} spellCheck={false} />
    </section>
  );
}
