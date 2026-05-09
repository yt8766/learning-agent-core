import { Boxes, Sparkles, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export type GatewayProviderSummary = {
  key: string;
  tone: string;
};

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="gateway-page-header">
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </header>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="gateway-section-title">{children}</h2>;
}

export function MetricCard({
  icon: Icon,
  value,
  label,
  note,
  to,
  className
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  note: string;
  to?: string;
  className?: string;
}) {
  return (
    <Link className={`gateway-metric-card ${className ?? ''}`} to={to ?? '/'}>
      <span>
        <Icon className="size-7" />
      </span>
      <strong>{value}</strong>
      <p>{label}</p>
      <small>{note}</small>
    </Link>
  );
}

export function ProviderMark({ tone }: { tone: string }) {
  return (
    <span className={`gateway-provider-mark is-${tone}`} aria-hidden="true">
      <Sparkles className="size-5" />
    </span>
  );
}

export function ProviderDock({ providers }: { providers: GatewayProviderSummary[] }) {
  return (
    <div className="gateway-provider-dock" aria-label="提供商快捷切换">
      {providers.map(provider => (
        <span key={provider.key}>
          <ProviderMark tone={provider.tone} />
        </span>
      ))}
    </div>
  );
}

export function ToggleLabel({ label }: { label: string }) {
  return (
    <label className="gateway-toggle-label">
      <input type="checkbox" />
      <span />
      {label}
    </label>
  );
}

export function OAuthManagementSections() {
  return (
    <div className="gateway-provider-stack">
      <section className="gateway-card gateway-oauth-section">
        <header>
          <h2>OAuth 模型禁用</h2>
          <button className="gateway-primary-button" type="button">
            新增禁用
          </button>
        </header>
        <article>
          <div>
            <strong>oauth-excluded-models</strong>
            <p>未配置禁用模型</p>
          </div>
          <div className="gateway-actions">
            <button className="gateway-secondary-button" type="button">
              编辑
            </button>
            <button className="gateway-danger-button" type="button">
              删除提供商
            </button>
          </div>
        </article>
      </section>
      <section className="gateway-card gateway-oauth-section">
        <header>
          <h2>OAuth 模型别名</h2>
          <div className="gateway-actions">
            <button className="gateway-secondary-button" type="button">
              管理
            </button>
            <button className="gateway-primary-button" type="button">
              新增别名
            </button>
          </div>
        </header>
        <div className="gateway-empty-box">
          <span>
            <Boxes className="size-6" />
          </span>
          <strong>暂无任何提供商的模型别名，点击“新增别名”创建。</strong>
        </div>
      </section>
    </div>
  );
}
