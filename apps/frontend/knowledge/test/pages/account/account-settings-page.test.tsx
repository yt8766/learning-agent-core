/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

let mockStoreState: any = {
  avatar: '',
  displayName: 'Test User',
  updateAvatar: vi.fn(),
  updateDisplayName: vi.fn()
};

vi.mock('@/pages/account/account-store', () => ({
  useAccountProfileStore: vi.fn((selector: any) => selector(mockStoreState))
}));

vi.mock('@/pages/shared/ui', () => ({
  PageSection: ({ children, title, subTitle }: any) => (
    <section className="page-section">
      <h2>{title}</h2>
      <p>{subTitle}</p>
      {children}
    </section>
  )
}));

vi.mock('antd', () => {
  const Form = Object.assign(
    ({ children, layout, initialValues, onFinish, onValuesChange }: any) => (
      <form
        className="form"
        data-layout={layout}
        data-initial={JSON.stringify(initialValues)}
        data-has-finish={onFinish ? 'true' : 'false'}
        data-has-values-change={onValuesChange ? 'true' : 'false'}
      >
        {children}
      </form>
    ),
    {
      Item: ({ children, label, name }: any) => (
        <div className="form-item" data-label={label} data-name={name}>
          {children}
        </div>
      )
    }
  );

  const Input = Object.assign(
    ({ placeholder, prefix }: any) => <input placeholder={placeholder} data-prefix={prefix ? 'true' : 'false'} />,
    {
      Password: ({ autoComplete, prefix }: any) => (
        <input type="password" autoComplete={autoComplete} data-prefix={prefix ? 'true' : 'false'} />
      )
    }
  );

  return {
    Avatar: ({ size, src, icon }: any) => (
      <div className="avatar" data-size={size} data-src={src}>
        {icon}
      </div>
    ),
    Button: ({ children, icon, type }: any) => (
      <button className={`btn ${type ?? ''}`}>
        {icon}
        {children}
      </button>
    ),
    Card: ({ children, className }: any) => <div className={`card ${className ?? ''}`}>{children}</div>,
    Col: ({ children }: any) => <div className="col">{children}</div>,
    Form,
    Input,
    Row: ({ children }: any) => <div className="row">{children}</div>,
    Space: ({ children, align, orientation, size }: any) => (
      <div className="space" data-align={align} data-orientation={orientation} data-size={size}>
        {children}
      </div>
    ),
    Typography: {
      Text: ({ children, type, className }: any) => (
        <span data-type={type} className={className}>
          {children}
        </span>
      )
    },
    Upload: ({ children, accept }: any) => (
      <div className="upload" data-accept={accept}>
        {children}
      </div>
    )
  };
});

vi.mock('@ant-design/icons', () => ({
  CameraOutlined: () => null,
  LockOutlined: () => null,
  SaveOutlined: () => null,
  UserOutlined: () => null
}));

import { AccountSettingsPage } from '@/pages/account/account-settings-page';

describe('AccountSettingsPage', () => {
  it('renders the page title and subtitle', () => {
    const html = renderToStaticMarkup(<AccountSettingsPage />);
    expect(html).toContain('个人设置');
    expect(html).toContain('维护控制台显示名称');
  });

  it('renders the avatar section', () => {
    const html = renderToStaticMarkup(<AccountSettingsPage />);
    expect(html).toContain('avatar');
    expect(html).toContain('更换头像');
  });

  it('renders the form with display name field', () => {
    const html = renderToStaticMarkup(<AccountSettingsPage />);
    expect(html).toContain('显示名称');
    expect(html).toContain('form');
  });

  it('renders password fields', () => {
    const html = renderToStaticMarkup(<AccountSettingsPage />);
    expect(html).toContain('当前密码');
    expect(html).toContain('新密码');
    expect(html).toContain('确认新密码');
  });

  it('renders the save button', () => {
    const html = renderToStaticMarkup(<AccountSettingsPage />);
    expect(html).toContain('保存设置');
  });

  it('renders the upload accept filter', () => {
    const html = renderToStaticMarkup(<AccountSettingsPage />);
    expect(html).toContain('image/*');
  });

  it('renders the profile card', () => {
    const html = renderToStaticMarkup(<AccountSettingsPage />);
    expect(html).toContain('knowledge-account-profile-card');
  });

  it('renders avatar with src when set', () => {
    mockStoreState = { ...mockStoreState, avatar: 'https://example.com/avatar.png' };
    const html = renderToStaticMarkup(<AccountSettingsPage />);
    expect(html).toContain('https://example.com/avatar.png');
  });

  it('renders form with initial display name', () => {
    mockStoreState = { ...mockStoreState, displayName: 'Custom Name' };
    const html = renderToStaticMarkup(<AccountSettingsPage />);
    expect(html).toContain('Custom Name');
  });

  it('renders hint text not shown when password not touched', () => {
    const html = renderToStaticMarkup(<AccountSettingsPage />);
    expect(html).not.toContain('密码字段当前仅做前端表单演示');
  });

  it('renders form with onFinish handler', () => {
    const html = renderToStaticMarkup(<AccountSettingsPage />);
    expect(html).toContain('data-has-finish="true"');
  });

  it('renders form with onValuesChange handler', () => {
    const html = renderToStaticMarkup(<AccountSettingsPage />);
    expect(html).toContain('data-has-values-change="true"');
  });

  it('renders form layout as vertical', () => {
    const html = renderToStaticMarkup(<AccountSettingsPage />);
    expect(html).toContain('data-layout="vertical"');
  });

  it('renders password fields with autoComplete attributes', () => {
    const html = renderToStaticMarkup(<AccountSettingsPage />);
    expect(html).toContain('current-password');
    expect(html).toContain('new-password');
  });

  it('renders upload component for avatar', () => {
    const html = renderToStaticMarkup(<AccountSettingsPage />);
    expect(html).toContain('upload');
  });

  it('renders secondary text about avatar persistence', () => {
    const html = renderToStaticMarkup(<AccountSettingsPage />);
    expect(html).toContain('头像仅在本地预览');
  });
});
