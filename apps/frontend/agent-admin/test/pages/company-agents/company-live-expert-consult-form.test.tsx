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
  Input: ({
    id,
    placeholder,
    value,
    onChange,
    required,
    type,
    min,
    max,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy
  }: any) => (
    <input
      id={id}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={onChange}
      required={required}
      type={type}
      min={min}
      max={max}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
    />
  )
}));

import { CompanyLiveExpertConsultForm } from '@/pages/company-agents/company-live-expert-consult-form';

describe('CompanyLiveExpertConsultForm', () => {
  it('renders all form fields', () => {
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultForm onSubmit={vi.fn()} />);

    expect(html).toContain('会诊问题');
    expect(html).toContain('Brief ID');
    expect(html).toContain('目标平台');
    expect(html).toContain('脚本内容');
    expect(html).toContain('时长（秒）');
    expect(html).toContain('Voice ID');
    expect(html).toContain('发起专家会诊');
  });

  it('renders submit button as not loading by default', () => {
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultForm onSubmit={vi.fn()} />);

    expect(html).toContain('发起专家会诊');
    expect(html).not.toContain('会诊中...');
  });

  it('renders submit button as loading when loading prop is true', () => {
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultForm onSubmit={vi.fn()} loading={true} />);

    expect(html).toContain('会诊中...');
  });

  it('renders form with correct input ids', () => {
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultForm onSubmit={vi.fn()} />);

    expect(html).toContain('cl-consult-question');
    expect(html).toContain('cl-consult-briefId');
    expect(html).toContain('cl-consult-platform');
    expect(html).toContain('cl-consult-script');
    expect(html).toContain('cl-consult-duration');
    expect(html).toContain('cl-consult-voice');
  });

  it('renders placeholder text for question field', () => {
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultForm onSubmit={vi.fn()} />);

    expect(html).toContain('例如：这段直播开场如何提高停留和转化？');
  });

  it('renders default platform value', () => {
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultForm onSubmit={vi.fn()} />);

    expect(html).toContain('douyin / bilibili / wechat-video');
  });
});
