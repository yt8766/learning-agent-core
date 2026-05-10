import { Archive } from 'lucide-react';
import type { GatewayProviderSpecificConfigListResponse, GatewayProviderSpecificConfigRecord } from '@agent/core';
import ampIcon from '../assets/provider-icons/amp.svg';
import claudeIcon from '../assets/provider-icons/claude.svg';
import codexIcon from '../assets/provider-icons/codex.svg';
import geminiIcon from '../assets/provider-icons/gemini.svg';
import openaiIcon from '../assets/provider-icons/openai-light.svg';
import vertexIcon from '../assets/provider-icons/vertex.svg';

type ProviderIconId = 'gemini' | 'codex' | 'claude' | 'vertex' | 'openai' | 'ampcode';

const providerSections = [
  {
    id: 'gemini',
    title: 'Gemini API 密钥',
    emptyTitle: '暂无Gemini密钥',
    emptyDetail: '点击上方按钮添加第一个密钥',
    addAction: '添加密钥',
    detail: 'API Key、项目路由和模型族 allowlist。',
    actions: ['保存密钥槽', '测试提供商', '刷新模型'],
    icon: 'gemini'
  },
  {
    id: 'codex',
    title: 'Codex API 配置',
    emptyTitle: '暂无Codex配置',
    emptyDetail: '点击上方按钮添加第一个配置',
    addAction: '添加配置',
    detail: 'Codex 上游路由、审批模式与执行 profile。',
    actions: ['绑定 profile', '验证路由', '检查模型'],
    icon: 'codex'
  },
  {
    id: 'claude',
    title: 'Claude API 配置',
    emptyTitle: '暂无Claude配置',
    emptyDetail: '点击上方按钮添加第一个配置',
    addAction: '添加配置',
    detail: 'Anthropic 兼容凭据 profile 与模型族控制。',
    actions: ['保存凭据', '探测端点', '同步模型列表'],
    icon: 'claude'
  },
  {
    id: 'vertex',
    title: 'Vertex API 配置',
    emptyTitle: '暂无Vertex配置',
    emptyDetail: '点击上方按钮导入服务账号配置',
    addAction: '导入配置',
    detail: 'Google Cloud 项目、区域、服务账号与导入边界。',
    actions: ['导入 Vertex 配置', '测试 IAM', '列出 Vertex 模型'],
    icon: 'vertex'
  },
  {
    id: 'openai-compatible',
    title: 'OpenAI 兼容配置',
    emptyTitle: '暂无OpenAI兼容配置',
    emptyDetail: '点击上方按钮添加第一个兼容端点',
    addAction: '添加配置',
    detail: 'Base URL、headers、模型发现和显式测试模型。',
    actions: ['模型发现', '测试模型', '保存兼容端点'],
    icon: 'openai'
  },
  {
    id: 'ampcode',
    title: 'Ampcode 桥接配置',
    emptyTitle: '暂无Ampcode配置',
    emptyDetail: '点击上方按钮添加第一个桥接配置',
    addAction: '添加配置',
    detail: 'Ampcode bridge 的上游密钥映射、模型映射和强制映射。',
    actions: ['上游密钥映射', '模型映射', '强制映射'],
    icon: 'ampcode'
  }
] satisfies Array<{
  id: string;
  title: string;
  emptyTitle: string;
  emptyDetail: string;
  addAction: string;
  detail: string;
  actions: string[];
  icon: ProviderIconId;
}>;

const providerIcons = {
  gemini: geminiIcon,
  codex: codexIcon,
  claude: claudeIcon,
  vertex: vertexIcon,
  openai: openaiIcon,
  ampcode: ampIcon
};

interface ProviderConfigPageProps {
  configs?: GatewayProviderSpecificConfigListResponse;
  onRefreshModels?: (providerId: string) => void;
  onTestModel?: (providerId: string, model: string) => void;
  onSaveProvider?: (providerId: string) => void;
}

export function ProviderConfigPage({
  configs = { items: [] },
  onRefreshModels,
  onSaveProvider,
  onTestModel
}: ProviderConfigPageProps) {
  const handleAction = (providerId: string, action: string): void => {
    if (action === '模型发现' || action === '刷新模型' || action === '检查模型' || action === '同步模型列表') {
      onRefreshModels?.(providerId);
      return;
    }
    if (action === '测试模型' || action === '测试提供商' || action === '探测端点') {
      onTestModel?.(providerId, 'default');
      return;
    }
    onSaveProvider?.(providerId);
  };

  return (
    <section className="provider-config-clone gateway-management-page" aria-label="AI 提供商配置">
      <h1 className="management-page-title">AI 提供商配置</h1>

      <div className="provider-config-list">
        {providerSections.map(section => {
          const sectionConfigs = configs.items.filter(config =>
            sectionMatchesProvider(section.id, config.providerType)
          );
          return (
            <article className="provider-config-card" id={section.id} key={section.id}>
              <header className="provider-card-header">
                <span className="provider-title-wrap">
                  <img className="provider-brand-icon" src={providerIcons[section.icon]} alt="" />
                  <span>{section.title}</span>
                </span>
                <button type="button" onClick={() => handleAction(section.id, section.addAction)}>
                  {section.addAction}
                </button>
              </header>
              {sectionConfigs.length > 0 ? (
                <div className="provider-config-record-list">
                  {sectionConfigs.map(config => (
                    <ProviderConfigRecordCard
                      config={config}
                      key={config.id}
                      onRefreshModels={onRefreshModels}
                      onSaveProvider={onSaveProvider}
                      onTestModel={onTestModel}
                    />
                  ))}
                </div>
              ) : (
                <div className="provider-empty-state">
                  <span className="provider-empty-icon">
                    <Archive size={30} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{section.emptyTitle}</h3>
                    <p>{section.emptyDetail}</p>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <nav className="provider-floating-nav" aria-label="AI 提供商快捷导航">
        {providerSections.map(section => (
          <a href={`#${section.id}`} key={section.id} aria-label={section.title}>
            <img src={providerIcons[section.icon]} alt="" />
          </a>
        ))}
      </nav>
    </section>
  );
}

function ProviderConfigRecordCard({
  config,
  onRefreshModels,
  onSaveProvider,
  onTestModel
}: {
  config: GatewayProviderSpecificConfigRecord;
  onRefreshModels?: (providerId: string) => void;
  onSaveProvider?: (providerId: string) => void;
  onTestModel?: (providerId: string, model: string) => void;
}) {
  const testModel = config.testModel ?? config.models[0]?.name ?? 'default';
  return (
    <article className="provider-config-record">
      <div className="provider-config-record-main">
        <div>
          <span className={`status-pill provider-${config.enabled ? 'enabled' : 'disabled'}`}>
            {config.enabled ? 'ENABLED' : 'DISABLED'}
          </span>
          <h3>{config.displayName}</h3>
          <p>{config.baseUrl ?? '使用默认上游地址'}</p>
        </div>
        <small>{config.id}</small>
      </div>
      <div className="provider-config-meta-grid">
        <span>
          <strong>{config.models.length}</strong>
          模型
        </span>
        <span>
          <strong>{config.credentials.length}</strong>
          凭据
        </span>
        <span>
          <strong>{config.excludedModels.length}</strong>
          排除
        </span>
      </div>
      <div className="provider-model-chip-row">
        {config.models.length > 0 ? (
          config.models.map(model => (
            <span className="model-chip" key={`${config.id}-${model.name}`}>
              {model.alias ? `${model.name} -> ${model.alias}` : model.name}
            </span>
          ))
        ) : (
          <span className="model-chip muted">未配置模型</span>
        )}
      </div>
      <div className="provider-credential-row">
        {config.credentials.length > 0 ? (
          config.credentials.map(credential => (
            <span key={credential.credentialId}>
              {credential.apiKeyMasked ?? credential.authIndex ?? credential.credentialId}
              <strong>{credential.status}</strong>
            </span>
          ))
        ) : (
          <span>暂无凭据</span>
        )}
      </div>
      <div className="provider-record-actions">
        <button type="button" onClick={() => onSaveProvider?.(config.id)}>
          保存
        </button>
        <button type="button" onClick={() => onTestModel?.(config.id, testModel)}>
          测试模型
        </button>
        <button type="button" onClick={() => onRefreshModels?.(config.id)}>
          刷新模型
        </button>
      </div>
    </article>
  );
}

function sectionMatchesProvider(
  sectionId: string,
  providerType: GatewayProviderSpecificConfigRecord['providerType']
): boolean {
  if (sectionId === 'openai-compatible') return providerType === 'openaiCompatible';
  return sectionId === providerType;
}
