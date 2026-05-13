import { Code2, GitCompare, RefreshCcw, Save } from 'lucide-react';
import { useState } from 'react';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';

interface ConfigEditorPageProps {
  content?: string;
  version?: string;
  dirty?: boolean;
  saving?: boolean;
  lastMessage?: string | null;
  onDiff?: (content?: string) => Promise<unknown> | void;
  onReload?: () => Promise<unknown> | void;
  onSave?: (content?: string) => Promise<unknown> | void;
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
  const [editorContent, setEditorContent] = useState(content);
  const [operation, setOperation] = useState<{
    status: 'idle' | 'running' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: lastMessage ?? '等待操作' });
  useUnsavedChangesGuard(dirty);

  const runOperation = async (
    label: string,
    callback: ((content?: string) => Promise<unknown> | void) | undefined
  ): Promise<unknown> => {
    if (!callback) {
      const message = `${label} 未接入 AgentGatewayApiClient`;
      setOperation({ status: 'error', message });
      throw new Error(message);
    }
    setOperation({ status: 'running', message: `${label}中` });
    try {
      const result = await callback(editorContent);
      setOperation({ status: 'success', message: `${label}完成` });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : `${label}失败`;
      setOperation({ status: 'error', message });
      throw error;
    }
  };

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
        <button
          type="button"
          disabled={operation.status === 'running'}
          onClick={() => void runOperation('查看差异', onDiff)}
        >
          <GitCompare size={15} aria-hidden="true" />
          查看差异
        </button>
        <button
          type="button"
          disabled={operation.status === 'running'}
          onClick={() => void runOperation('保存配置', onSave)}
        >
          <Save size={15} aria-hidden="true" />
          保存配置
        </button>
        <button
          type="button"
          disabled={operation.status === 'running'}
          onClick={() => void runOperation('重新加载', onReload)}
        >
          <RefreshCcw size={15} aria-hidden="true" />
          重新加载
        </button>
      </div>
      <p role="status" className={`operation-status status-${operation.status}`}>
        {operation.message}
      </p>
      <textarea
        className="raw-config-editor"
        onChange={event => setEditorContent(event.target.value)}
        spellCheck={false}
        value={editorContent}
      />
    </section>
  );
}
