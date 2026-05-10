import type { GatewayDashboardSummaryResponse } from '@agent/core';
import { Bot, Clock, FileKey2, KeyRound, Network, Route, Server, ShieldCheck, Sparkles } from 'lucide-react';

interface DashboardPageProps {
  summary: GatewayDashboardSummaryResponse;
}

export function DashboardPage({ summary }: DashboardPageProps) {
  const metrics = [
    {
      icon: KeyRound,
      label: '管理密钥',
      value: `${summary.counts.managementApiKeys} 个管理密钥`,
      detail: '用于 Management API 的受控访问凭据'
    },
    {
      icon: FileKey2,
      label: '认证文件',
      value: `${summary.counts.authFiles} 个认证文件`,
      detail: 'OAuth 与本地凭据索引'
    },
    {
      icon: Bot,
      label: 'Provider 凭据',
      value: `${summary.counts.providerCredentials} 组上游凭据`,
      detail: '按 provider 聚合的路由能力'
    },
    {
      icon: Sparkles,
      label: '可用模型',
      value: `${summary.counts.availableModels} 个可用模型`,
      detail: '来自 /v1/models 的模型投影'
    }
  ];

  return (
    <section className="dashboard-clone gateway-management-page" aria-label="仪表盘">
      <div className="dashboard-background-orbs" aria-hidden="true">
        <span className="dashboard-orb-one" />
        <span className="dashboard-orb-two" />
      </div>

      <section className="dashboard-hero">
        <span className="dashboard-watermark">AGENT GATEWAY</span>
        <div className="dashboard-hero-copy">
          <span className="page-eyebrow">Agent Gateway 运行总览</span>
          <h2>仪表盘</h2>
          <p>统一查看管理密钥、认证文件、上游 provider 和模型路由状态。</p>
        </div>
        <div className="dashboard-hero-meta">
          <div>
            <strong>{new Date(summary.observedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</strong>
            <span>{new Date(summary.observedAt).toLocaleDateString('zh-CN')}</span>
          </div>
          <span className={`connection-pill status-${summary.connection.status}`}>
            <span className={`dashboard-status-dot ${summary.connection.status}`} />
            <ShieldCheck size={14} aria-hidden="true" />
            {summary.connection.status}
          </span>
        </div>
      </section>

      <section className="dashboard-stats-section">
        <h3 className="section-kicker">Quick Stats</h3>
        <div className="dashboard-bento-grid">
        {metrics.map(metric => {
          const Icon = metric.icon;
          return (
              <article
                className={`dashboard-bento-card dashboard-animated-card${metric.label === '管理密钥' ? ' bento-large' : ''}`}
                key={metric.label}
              >
              <span className="dashboard-bento-icon">
                <Icon size={18} aria-hidden="true" />
              </span>
                <div>
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                  <small>{metric.detail}</small>
                </div>
            </article>
          );
        })}
      </div>
      </section>

      <section className="config-pill-section">
        <h3 className="section-kicker">Runtime Config</h3>
        <div className="config-pill-grid">
          <span className="config-pill wide">
            <Network size={14} aria-hidden="true" />
            <span>API Base</span>
            <strong>{summary.connection.apiBase ?? '本地确定性管理客户端'}</strong>
          </span>
          <span className="config-pill">
            <Server size={18} aria-hidden="true" />
            <span>版本</span>
            <strong>{summary.connection.serverVersion ?? '-'}</strong>
          </span>
          <span className="config-pill">
            <Route size={18} aria-hidden="true" />
            <span>路由</span>
            <strong>{summary.routing.strategy}</strong>
          </span>
          <span className="config-pill">
            <Clock size={18} aria-hidden="true" />
            <span>重试</span>
            <strong>{summary.routing.requestRetry} 次</strong>
          </span>
          <span className="config-pill">
            <Network size={18} aria-hidden="true" />
            <span>代理</span>
            <strong>{summary.routing.proxyUrl ?? '未配置'}</strong>
          </span>
        </div>
      </section>
    </section>
  );
}
