import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, type, disabled, className }: any) => (
    <button type={type} disabled={disabled} className={className}>
      {children}
    </button>
  )
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ id, placeholder, value, onChange, required, type, min, max }: any) => (
    <input
      id={id}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={onChange}
      required={required}
      type={type}
      min={min}
      max={max}
    />
  )
}));

import { CompanyLiveGenerateForm } from '@/pages/company-agents/company-live-generate-form';

describe('CompanyLiveGenerateForm', () => {
  it('renders all form fields', () => {
    const html = renderToStaticMarkup(<CompanyLiveGenerateForm onSubmit={vi.fn()} />);

    expect(html).toContain('Brief ID');
    expect(html).toContain('目标平台');
    expect(html).toContain('脚本内容');
    expect(html).toContain('时长（秒）');
    expect(html).toContain('Voice ID');
    expect(html).toContain('生成直播内容');
  });

  it('renders submit button as not loading by default', () => {
    const html = renderToStaticMarkup(<CompanyLiveGenerateForm onSubmit={vi.fn()} />);

    expect(html).toContain('生成直播内容');
    expect(html).not.toContain('生成中…');
  });

  it('renders submit button as loading when loading prop is true', () => {
    const html = renderToStaticMarkup(<CompanyLiveGenerateForm onSubmit={vi.fn()} loading={true} />);

    expect(html).toContain('生成中…');
  });

  it('renders form with correct input ids', () => {
    const html = renderToStaticMarkup(<CompanyLiveGenerateForm onSubmit={vi.fn()} />);

    expect(html).toContain('cl-briefId');
    expect(html).toContain('cl-platform');
    expect(html).toContain('cl-script');
    expect(html).toContain('cl-duration');
    expect(html).toContain('cl-voice');
  });

  it('renders placeholder text for brief id', () => {
    const html = renderToStaticMarkup(<CompanyLiveGenerateForm onSubmit={vi.fn()} />);

    expect(html).toContain('brief-001');
  });

  it('renders placeholder text for script', () => {
    const html = renderToStaticMarkup(<CompanyLiveGenerateForm onSubmit={vi.fn()} />);

    expect(html).toContain('请输入直播脚本...');
  });
});
