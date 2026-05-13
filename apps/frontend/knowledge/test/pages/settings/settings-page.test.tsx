/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('antd', () => {
  const FormItem = ({ children, label }: any) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  );

  return {
    Card: ({ children, className, title }: any) => (
      <div className={className} data-title={title}>
        {children}
      </div>
    ),
    Col: ({ children }: any) => <div>{children}</div>,
    Form: Object.assign(({ children, layout }: any) => <form data-layout={layout}>{children}</form>, {
      Item: FormItem
    }),
    Input: Object.assign(
      ({ defaultValue, placeholder }: any) => <input defaultValue={defaultValue} placeholder={placeholder} />,
      { Password: ({ autoComplete }: any) => <input type="password" autoComplete={autoComplete} /> }
    ),
    Row: ({ children }: any) => <div>{children}</div>,
    Select: ({ defaultValue, options }: any) => (
      <select defaultValue={defaultValue}>
        {options?.map((opt: any) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    ),
    Space: ({ children }: any) => <div>{children}</div>,
    Switch: ({ defaultChecked }: any) => <input type="checkbox" defaultChecked={defaultChecked} />
  };
});

vi.mock('@/pages/shared/ui', () => ({
  LifecycleRail: ({ steps }: any) => (
    <div>
      {steps?.map((step: any) => (
        <div key={step.key}>
          {step.title}: {step.metric}
        </div>
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

import { SettingsPage } from '@/pages/settings/settings-page';

describe('SettingsPage', () => {
  it('renders page title', () => {
    const html = renderToStaticMarkup(<SettingsPage />);

    expect(html).toContain('系统策略');
    expect(html).toContain('System Policy');
  });

  it('renders subtitle', () => {
    const html = renderToStaticMarkup(<SettingsPage />);

    expect(html).toContain('统一配置默认检索链路、模型 profile、密钥、存储和安全策略');
  });

  it('renders lifecycle rail steps', () => {
    const html = renderToStaticMarkup(<SettingsPage />);

    expect(html).toContain('模型');
    expect(html).toContain('凭据');
    expect(html).toContain('存储');
    expect(html).toContain('安全');
  });

  it('renders policy section card', () => {
    const html = renderToStaticMarkup(<SettingsPage />);

    expect(html).toContain('策略分区');
  });

  it('renders RAG policy form', () => {
    const html = renderToStaticMarkup(<SettingsPage />);

    expect(html).toContain('默认 RAG 策略');
    expect(html).toContain('默认向量库');
    expect(html).toContain('Embedding Provider');
    expect(html).toContain('高风险知识变更审批');
  });

  it('renders vector store options', () => {
    const html = renderToStaticMarkup(<SettingsPage />);

    expect(html).toContain('Supabase PostgreSQL + pgvector');
    expect(html).toContain('Chroma');
  });

  it('renders embedding provider default value', () => {
    const html = renderToStaticMarkup(<SettingsPage />);

    expect(html).toContain('Project EmbeddingProvider facade');
  });
});
