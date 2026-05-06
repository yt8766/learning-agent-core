import type { ReactNode } from 'react';
import { Card, Space, Statistic, Tag, Typography } from 'antd';

export interface RagOpsMetric {
  key: string;
  label: string;
  status?: 'critical' | 'healthy' | 'muted' | 'running' | 'warning';
  suffix?: string;
  value: number | string;
}

export interface LifecycleStep {
  description: string;
  key: string;
  metric: string;
  status: 'critical' | 'healthy' | 'running' | 'warning';
  title: string;
}

const statusLabel: Record<NonNullable<RagOpsMetric['status']> | LifecycleStep['status'], string> = {
  critical: '风险',
  healthy: '健康',
  muted: '观测',
  running: '运行中',
  warning: '关注'
};

const statusColor: Record<NonNullable<RagOpsMetric['status']> | LifecycleStep['status'], string> = {
  critical: 'error',
  healthy: 'success',
  muted: 'default',
  running: 'processing',
  warning: 'warning'
};

export function PageSection({
  children,
  extra,
  subTitle,
  title
}: {
  children: ReactNode;
  extra?: ReactNode;
  subTitle?: string;
  title: string;
}) {
  return (
    <section className="knowledge-pro-page">
      <Space align="start" style={{ justifyContent: 'space-between', width: '100%' }}>
        <Space orientation="vertical" size={2}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {subTitle ? <Typography.Text type="secondary">{subTitle}</Typography.Text> : null}
        </Space>
        {extra}
      </Space>
      {children}
    </section>
  );
}

export function RagOpsPage({
  children,
  eyebrow = 'RAG Operations',
  extra,
  subTitle,
  title
}: {
  children: ReactNode;
  eyebrow?: string;
  extra?: ReactNode;
  subTitle?: string;
  title: string;
}) {
  return (
    <section className="rag-ops-page">
      <div className="rag-ops-page-header">
        <Space className="rag-ops-page-heading" orientation="vertical" size={6}>
          <Typography.Text className="rag-ops-eyebrow">{eyebrow}</Typography.Text>
          <Typography.Title level={1}>{title}</Typography.Title>
          {subTitle ? <Typography.Text className="rag-ops-subtitle">{subTitle}</Typography.Text> : null}
        </Space>
        {extra ? <div className="rag-ops-page-actions">{extra}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function MetricStrip({ metrics }: { metrics: RagOpsMetric[] }) {
  return (
    <div className="rag-ops-metric-strip">
      {metrics.map(metric => (
        <Card className="rag-ops-metric-card" key={metric.key} size="small">
          <Space align="start" className="rag-ops-metric-card-inner">
            <Statistic title={metric.label} value={metric.value} suffix={metric.suffix} />
            {metric.status ? <StatusPill status={metric.status} /> : null}
          </Space>
        </Card>
      ))}
    </div>
  );
}

export function LifecycleRail({ steps }: { steps: LifecycleStep[] }) {
  return (
    <div className="rag-ops-lifecycle-rail">
      {steps.map((step, index) => (
        <article className="rag-ops-lifecycle-step" key={step.key}>
          <span className="rag-ops-lifecycle-index">{index + 1}</span>
          <div>
            <Space align="center" size={8}>
              <Typography.Text strong>{step.title}</Typography.Text>
              <StatusPill status={step.status} />
            </Space>
            <Typography.Paragraph className="rag-ops-lifecycle-copy">{step.description}</Typography.Paragraph>
            <Typography.Text className="rag-ops-lifecycle-metric">{step.metric}</Typography.Text>
          </div>
        </article>
      ))}
    </div>
  );
}

export function InsightList({ items }: { items: string[] }) {
  return (
    <ul className="rag-ops-insight-list">
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function StatusPill({ status }: { status: NonNullable<RagOpsMetric['status']> | LifecycleStep['status'] }) {
  return (
    <Tag className="rag-ops-status-pill" color={statusColor[status]}>
      {statusLabel[status]}
    </Tag>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="knowledge-pro-card-grid">{children}</div>;
}
