const providerSections = [
  {
    id: 'gemini',
    title: 'Gemini',
    detail: 'API key、project routing、model family allowlist.',
    actions: ['Save key slot', 'Test provider', 'Refresh models']
  },
  {
    id: 'codex',
    title: 'Codex',
    detail: 'Codex upstream routing, approval mode, and execution profile.',
    actions: ['Bind profile', 'Validate route', 'Inspect models']
  },
  {
    id: 'claude',
    title: 'Claude',
    detail: 'Anthropic-compatible credential profile with model family controls.',
    actions: ['Save credential', 'Probe endpoint', 'Sync model list']
  },
  {
    id: 'vertex',
    title: 'Vertex',
    detail: 'Google Cloud project, region, service account, and import boundary.',
    actions: ['Import Vertex config', 'Test IAM', 'List Vertex models']
  },
  {
    id: 'openai-compatible',
    title: 'OpenAI-compatible',
    detail: 'Base URL, headers, model discovery, and explicit test model.',
    actions: ['Model discovery', 'Test model', 'Save compatible endpoint']
  },
  {
    id: 'ampcode',
    title: 'Ampcode',
    detail: 'Ampcode bridge with upstream key mappings, model mappings, and force mappings.',
    actions: ['Upstream key mappings', 'Model mappings', 'Force mappings']
  }
];

interface ProviderConfigPageProps {
  onRefreshModels?: (providerId: string) => void;
  onTestModel?: (providerId: string, model: string) => void;
  onSaveProvider?: (providerId: string) => void;
}

export function ProviderConfigPage({ onRefreshModels, onSaveProvider, onTestModel }: ProviderConfigPageProps) {
  const handleAction = (providerId: string, action: string): void => {
    if (
      action === 'Model discovery' ||
      action === 'Refresh models' ||
      action === 'Inspect models' ||
      action === 'Sync model list'
    ) {
      onRefreshModels?.(providerId);
      return;
    }
    if (action === 'Test model' || action === 'Test provider' || action === 'Probe endpoint') {
      onTestModel?.(providerId, 'default');
      return;
    }
    onSaveProvider?.(providerId);
  };

  return (
    <section className="page-stack" aria-label="Provider Config">
      <div className="section-heading">
        <h2>Provider Config</h2>
        <p>集中配置上游 provider 能力面，只呈现项目自定义字段，不透传 raw vendor payload。</p>
      </div>

      <div className="metric-grid">
        {providerSections.map(section => (
          <article className="command-panel" key={section.id}>
            <div className="section-heading">
              <h3>{section.title}</h3>
              <p>{section.detail}</p>
            </div>
            <div className="command-actions">
              {section.actions.map(action => (
                <button key={action} type="button" onClick={() => handleAction(section.id, action)}>
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
