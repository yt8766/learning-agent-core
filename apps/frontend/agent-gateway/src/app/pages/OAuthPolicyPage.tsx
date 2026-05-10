const oauthPolicyGroups = [
  {
    title: 'Excluded models',
    detail: '按 provider 和模型模式维护 OAuth 授权不可用列表。',
    actions: ['Add excluded model', 'Remove excluded model']
  },
  {
    title: 'Model aliases',
    detail: '维护模型别名、Fork alias 和兼容迁移映射。',
    actions: ['Create alias', 'Fork alias', 'Validate aliases']
  },
  {
    title: 'Callback polling',
    detail: '查看 OAuth callback 接收状态、轮询窗口和失败重试。',
    actions: ['Start callback polling', 'Stop callback polling']
  },
  {
    title: 'Status polling',
    detail: '定时刷新授权文件、provider 可用性和模型同步状态。',
    actions: ['Refresh status', 'Inspect poll log']
  },
  {
    title: 'Vertex import',
    detail: '从 Vertex 凭据导入 OAuth policy 约束与模型别名初始值。',
    actions: ['Import Vertex policy', 'Preview import diff']
  }
];

interface OAuthPolicyPageProps {
  onAddExcludedModel?: () => void;
  onCreateAlias?: () => void;
  onForkAlias?: () => void;
  onStartCallbackPolling?: () => void;
  onRefreshStatus?: () => void;
  onImportVertexPolicy?: () => void;
}

export function OAuthPolicyPage({
  onAddExcludedModel,
  onCreateAlias,
  onForkAlias,
  onImportVertexPolicy,
  onRefreshStatus,
  onStartCallbackPolling
}: OAuthPolicyPageProps) {
  const handlers: Record<string, (() => void) | undefined> = {
    'Add excluded model': onAddExcludedModel,
    'Create alias': onCreateAlias,
    'Fork alias': onForkAlias,
    'Start callback polling': onStartCallbackPolling,
    'Refresh status': onRefreshStatus,
    'Import Vertex policy': onImportVertexPolicy
  };

  return (
    <section className="page-stack" aria-label="OAuth Policy">
      <div className="section-heading">
        <h2>OAuth Policy</h2>
        <p>OAuth 策略治理覆盖模型排除、别名演进、callback/status polling 与 Vertex 导入。</p>
      </div>

      <div className="metric-grid">
        {oauthPolicyGroups.map(group => (
          <article className="command-panel" key={group.title}>
            <div className="section-heading">
              <h3>{group.title}</h3>
              <p>{group.detail}</p>
            </div>
            <div className="command-actions">
              {group.actions.map(action => (
                <button key={action} type="button" onClick={handlers[action]}>
                  {action}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
