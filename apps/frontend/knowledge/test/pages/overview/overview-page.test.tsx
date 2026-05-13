/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('antd', () => ({
  Card: ({ children, className, title }: any) => (
    <div className={className} data-title={title}>
      {children}
    </div>
  ),
  Col: ({ children }: any) => <div>{children}</div>,
  Progress: ({ percent, status }: any) => (
    <div data-percent={percent} data-status={status}>
      Progress
    </div>
  ),
  Row: ({ children }: any) => <div>{children}</div>,
  Space: ({ children }: any) => <div>{children}</div>,
  Table: ({ dataSource, rowKey }: any) => <table data-rowkey={rowKey} data-count={dataSource?.length ?? 0}></table>,
  Tag: ({ children, color }: any) => <span data-color={color}>{children}</span>,
  Typography: {
    Paragraph: ({ children }: any) => <p>{children}</p>,
    Text: ({ children, strong, type }: any) => {
      if (strong) return <strong>{children}</strong>;
      return <span data-type={type}>{children}</span>;
    }
  }
}));

vi.mock('echarts-for-react', () => ({
  default: ({ className }: any) => <div className={className}>Chart</div>
}));

vi.mock('@/pages/shared/ui', () => ({
  InsightList: ({ items }: any) => (
    <ul>
      {items?.map((item: string, i: number) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  ),
  LifecycleRail: ({ steps }: any) => (
    <div>
      {steps?.map((step: any) => (
        <div key={step.key}>
          {step.title}: {step.metric}
        </div>
      ))}
    </div>
  ),
  MetricStrip: ({ metrics }: any) => (
    <div>
      {metrics?.map((m: any) => (
        <span key={m.key}>
          {m.label}: {m.value}
          {m.suffix}
        </span>
      ))}
    </div>
  ),
  RagOpsPage: ({ children, title, subTitle, eyebrow }: any) => (
    <div>
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{subTitle}</p>
      {children}
    </div>
  )
}));

import { OverviewPage } from '@/pages/overview/overview-page';

describe('OverviewPage', () => {
  it('renders page title', () => {
    const html = renderToStaticMarkup(<OverviewPage />);

    expect(html).toContain('RAG 运行健康');
    expect(html).toContain('RAG Operations');
  });

  it('renders subtitle', () => {
    const html = renderToStaticMarkup(<OverviewPage />);

    expect(html).toContain('围绕摄取、索引、检索、引用、反馈和评测回归的统一运行面');
  });

  it('renders metrics strip', () => {
    const html = renderToStaticMarkup(<OverviewPage />);

    expect(html).toContain('知识空间');
    expect(html).toContain('Ready 文档');
    expect(html).toContain('检索质量');
    expect(html).toContain('引用覆盖');
    expect(html).toContain('负反馈率');
    expect(html).toContain('P95 延迟');
  });

  it('renders lifecycle steps', () => {
    const html = renderToStaticMarkup(<OverviewPage />);

    expect(html).toContain('摄取');
    expect(html).toContain('索引');
    expect(html).toContain('检索');
    expect(html).toContain('引用');
    expect(html).toContain('反馈');
  });

  it('renders risk table', () => {
    const html = renderToStaticMarkup(<OverviewPage />);

    expect(html).toContain('治理策略与风险队列');
  });

  it('renders charts', () => {
    const html = renderToStaticMarkup(<OverviewPage />);

    expect(html).toContain('检索质量趋势');
    expect(html).toContain('摄取管线吞吐');
  });

  it('renders feedback section', () => {
    const html = renderToStaticMarkup(<OverviewPage />);

    expect(html).toContain('反馈闭环');
  });

  it('renders insight list', () => {
    const html = renderToStaticMarkup(<OverviewPage />);

    expect(html).toContain('把客户计费策略的空召回问题加入评测回归集');
  });
});
