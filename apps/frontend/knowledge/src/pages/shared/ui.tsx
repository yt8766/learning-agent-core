import type { ReactNode } from 'react';
import { Space, Typography } from 'antd';

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

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="knowledge-pro-card-grid">{children}</div>;
}
