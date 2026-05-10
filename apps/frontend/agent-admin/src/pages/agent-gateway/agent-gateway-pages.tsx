import {
  Bot,
  Boxes,
  ExternalLink,
  FileCheck2,
  KeyRound,
  Network,
  Plus,
  RefreshCw,
  Search,
  Sparkles
} from 'lucide-react';

import './agent-gateway.css';
import {
  AUTH_FILE_FILTERS,
  OAUTH_PROVIDERS,
  PROVIDERS,
  QUOTA_SECTIONS,
  SYSTEM_INFO_TILES,
  SYSTEM_MODELS
} from './agent-gateway-data';
import { AgentGatewayShell } from './agent-gateway-shell';
import { useAgentGatewayStore } from './agent-gateway-store';
import {
  MetricCard,
  OAuthManagementSections,
  PageHeader,
  ProviderDock,
  ProviderMark,
  SectionTitle,
  ToggleLabel
} from './agent-gateway-widgets';

export { AgentGatewayConfigPage } from './agent-gateway-config-page';

export function AgentGatewayDashboardPage() {
  return (
    <AgentGatewayShell>
      <section className="gateway-hero" aria-label="管理中心欢迎区">
        <div>
          <p className="gateway-hero-kicker">晚上好</p>
          <h1>欢迎回来</h1>
          <p>今天辛苦了，收尾工作做好哦。</p>
          <span className="gateway-hero-watermark">OVERVIEW</span>
        </div>
        <div className="gateway-clock">
          <strong>20:47</strong>
          <span>2026年5月9日星期六</span>
          <em>
            <i />
            v1.0.0
          </em>
          <small>2026/5/4</small>
        </div>
      </section>

      <SectionTitle>系统概览</SectionTitle>
      <section className="gateway-overview-grid" aria-label="系统概览">
        <MetricCard
          className="gateway-metric-large"
          icon={KeyRound}
          value="1"
          label="管理密钥"
          note="配置面板"
          to="/config"
        />
        <MetricCard icon={Bot} value="0" label="AI提供商" note="G:0 C:0 Cl:0 O:0" to="/ai-providers" />
        <MetricCard icon={FileCheck2} value="3" label="认证文件" note="OAuth 凭证" to="/auth-files" />
        <MetricCard icon={Network} value="22" label="可用模型" note="所有提供商的模型总数" to="/system" />
      </section>

      <SectionTitle>当前配置</SectionTitle>
      <section className="gateway-config-strip">
        <div>
          <span>路由策略</span>
          <strong>优先填充</strong>
        </div>
        <div>
          <span>认证状态</span>
          <strong>已连接</strong>
        </div>
        <div>
          <span>运行模式</span>
          <strong>Gateway</strong>
        </div>
      </section>
    </AgentGatewayShell>
  );
}

export function AgentGatewayAiProvidersPage() {
  return (
    <AgentGatewayShell>
      <PageHeader title="AI 提供商配置" />
      <div className="gateway-provider-stack">
        {PROVIDERS.map(provider => (
          <section key={provider.key} className="gateway-card gateway-provider-card">
            <header>
              <div className="gateway-title-with-icon">
                <ProviderMark tone={provider.tone} />
                <h2>{provider.title}</h2>
              </div>
              <button className="gateway-primary-button" type="button">
                <Plus className="size-4" />
                {provider.action}
              </button>
            </header>
            <ProviderEmptyState empty={provider.empty} />
            <div className="gateway-provider-meta-row">
              <span>模型过滤 0</span>
              <span>成功 0</span>
              <span>失败 0</span>
              <span>最近请求 --</span>
            </div>
          </section>
        ))}
      </div>
      <ProviderDock providers={PROVIDERS} />
    </AgentGatewayShell>
  );
}

export function AgentGatewayAuthFilesPage() {
  const authFileFilter = useAgentGatewayStore(state => state.authFileFilter);
  const setAuthFileFilter = useAgentGatewayStore(state => state.setAuthFileFilter);

  return (
    <AgentGatewayShell>
      <PageHeader
        title="认证文件管理"
        description="这里集中管理 Agent Gateway 支持的所有 JSON 认证文件，上传后即可在运行时启用相应的 AI 服务。"
      />
      <section className="gateway-card gateway-auth-panel">
        <header>
          <div className="gateway-count-title">
            <h2>认证文件</h2>
            <span>3</span>
          </div>
          <div className="gateway-actions">
            <button className="gateway-secondary-button" type="button">
              <RefreshCw className="size-4" />
              刷新
            </button>
            <button className="gateway-primary-button" type="button">
              上传文件
            </button>
            <button className="gateway-danger-button" type="button">
              删除 AgentFlow
            </button>
          </div>
        </header>
        <div className="gateway-filter-tabs">
          {AUTH_FILE_FILTERS.map(filter => {
            const Icon = filter.icon;
            return (
              <button
                className={authFileFilter === filter.label ? 'is-active' : undefined}
                key={filter.label}
                onClick={() => setAuthFileFilter(filter.label)}
                type="button"
              >
                <Icon className="size-4" />
                {filter.label}
                <span>{filter.count}</span>
              </button>
            );
          })}
        </div>
        <div className="gateway-auth-controls">
          <label>
            搜索配置文件
            <span>
              <Search className="size-4" />
              <input placeholder="输入名称、类型或提供方关键字，支持 * 通配" />
            </span>
          </label>
          <label>
            单页数量
            <input defaultValue="9" />
          </label>
          <label>
            排序
            <select defaultValue="default">
              <option value="default">默认</option>
              <option value="updated">最近修改</option>
            </select>
          </label>
          <div className="gateway-switch-list">
            <ToggleLabel label="仅显示有问题凭证" />
            <ToggleLabel label="仅显示已停用凭证" />
            <ToggleLabel label="简略模式" />
          </div>
        </div>
        <article className="gateway-auth-file-card">
          <input aria-label="选择认证文件" type="checkbox" />
          <div className="gateway-file-icon">
            <Sparkles className="size-6" />
          </div>
          <div>
            <p>
              <span>AgentFlow</span>
              <em>启用</em>
            </p>
            <h3>agentflow-a17674328693@example.com.json</h3>
            <small>大小: 591.00 B 修改时间: 2026/5/9 18:29:48</small>
            <div className="gateway-file-badges">
              <span>成功 0</span>
              <span>失败 0</span>
            </div>
          </div>
        </article>
      </section>
      <OAuthManagementSections />
    </AgentGatewayShell>
  );
}

export function AgentGatewayOAuthPage() {
  return (
    <AgentGatewayShell>
      <PageHeader title="OAuth登录" description="集中发起模型服务授权、回调确认与凭证导入。" />
      <section className="gateway-card gateway-oauth-grid">
        {OAUTH_PROVIDERS.map(provider => (
          <article key={provider.title}>
            <ProviderMark tone={provider.tone} />
            <h2>{provider.title}</h2>
            <p>{provider.hint}</p>
            <div className="gateway-auth-url-box">
              <span>授权 URL</span>
              <strong>等待发起授权链接</strong>
            </div>
            <button className="gateway-primary-button" type="button">
              开始登录
            </button>
          </article>
        ))}
      </section>
      <OAuthManagementSections />
    </AgentGatewayShell>
  );
}

export function AgentGatewayQuotaPage() {
  return (
    <AgentGatewayShell>
      <PageHeader title="配额管理" description="按认证文件和模型来源查看额度、健康状态与刷新入口。" />
      <div className="gateway-provider-stack">
        {QUOTA_SECTIONS.map(section => {
          const Icon = section.icon;
          return (
            <section className="gateway-card gateway-quota-card" key={section.title}>
              <header>
                <div className="gateway-title-with-icon">
                  <Icon className="size-5" />
                  <h2>{section.title}</h2>
                  <span className="gateway-count-pill">{section.count}</span>
                </div>
                <button className="gateway-secondary-button" type="button">
                  <RefreshCw className="size-4" />
                  刷新全部
                </button>
              </header>
              <div className="gateway-quota-bar">
                <span style={{ width: `${section.value}%` }} />
              </div>
              <p>{section.note}</p>
            </section>
          );
        })}
      </div>
    </AgentGatewayShell>
  );
}

export function AgentGatewaySystemPage() {
  return (
    <AgentGatewayShell>
      <PageHeader title="中心信息" description="展示网关版本、构建时间、配置摘要和运行健康状态。" />
      <section className="gateway-card gateway-about-card">
        <div className="gateway-about-header">
          <div className="gateway-brand-mark gateway-about-logo">
            <Network className="size-10" />
          </div>
          <h2>Agent Gateway Management Center</h2>
        </div>
        <div className="gateway-info-grid">
          {SYSTEM_INFO_TILES.map(tile => (
            <article key={tile.label}>
              <span>{tile.label}</span>
              <strong>{tile.value}</strong>
              <small>{tile.sub}</small>
            </article>
          ))}
        </div>
      </section>
      <section className="gateway-system-layout">
        {['配置面板', '认证文件', 'AI提供商'].map(label => (
          <a
            className="gateway-system-card"
            href={label === '配置面板' ? '/config' : label === '认证文件' ? '/auth-files' : '/ai-providers'}
            key={label}
          >
            <ExternalLink className="size-5" />
            <strong>{label}</strong>
            <p>快速进入{label}管理。</p>
          </a>
        ))}
      </section>
      <section className="gateway-card gateway-model-card">
        <header>
          <h2>可用模型</h2>
          <button className="gateway-secondary-button" type="button">
            <RefreshCw className="size-4" />
            刷新
          </button>
        </header>
        {SYSTEM_MODELS.map(group => {
          const Icon = group.icon;
          return (
            <article className="gateway-model-row" key={group.group}>
              <div>
                <Icon className="size-5" />
                <strong>{group.group}</strong>
                <span>{group.count}</span>
              </div>
              <p>
                {group.models.map(model => (
                  <em key={model}>{model}</em>
                ))}
              </p>
            </article>
          );
        })}
      </section>
      <section className="gateway-card gateway-clear-card">
        <div>
          <h2>清理登录状态</h2>
          <p>清理本地管理会话缓存，不影响服务端配置。</p>
        </div>
        <button className="gateway-danger-button" type="button">
          清理登录
        </button>
      </section>
    </AgentGatewayShell>
  );
}

function ProviderEmptyState({ empty }: { empty: string }) {
  return (
    <div className="gateway-empty-box">
      <span>
        <Boxes className="size-6" />
      </span>
      <div>
        <strong>{empty}</strong>
        <p>点击上方按钮添加第一个配置</p>
      </div>
    </div>
  );
}
