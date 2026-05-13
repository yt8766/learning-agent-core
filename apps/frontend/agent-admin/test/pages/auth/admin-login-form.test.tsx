import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  Eye: () => 'Eye',
  EyeOff: () => 'EyeOff',
  Loader2: () => 'Loader2',
  LogIn: () => 'LogIn'
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, type, className }: any) => (
    <button type={type} className={className}>
      {children}
    </button>
  )
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ id, name, placeholder, value, onChange, autoComplete, type, className }: any) => (
    <input
      id={id}
      name={name}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={onChange}
      autoComplete={autoComplete}
      type={type}
      className={className}
    />
  )
}));

vi.mock('../api/admin-auth.api', () => ({
  loginAdminAuth: vi.fn()
}));

vi.mock('../store/admin-auth-store', () => ({
  adminAuthStore: {
    setAuthenticating: vi.fn(),
    setAuthenticated: vi.fn(),
    clear: vi.fn()
  }
}));

import { AdminLoginForm } from '@/pages/auth/components/admin-login-form';

describe('AdminLoginForm', () => {
  it('renders login form with username and password fields', () => {
    const html = renderToStaticMarkup(<AdminLoginForm />);

    expect(html).toContain('账号');
    expect(html).toContain('密码');
    expect(html).toContain('请输入账号');
    expect(html).toContain('请输入密码');
  });

  it('renders remember login checkbox', () => {
    const html = renderToStaticMarkup(<AdminLoginForm />);

    expect(html).toContain('记住登录');
  });

  it('renders login button', () => {
    const html = renderToStaticMarkup(<AdminLoginForm />);

    expect(html).toContain('登入');
  });

  it('renders show password toggle', () => {
    const html = renderToStaticMarkup(<AdminLoginForm />);

    expect(html).toContain('显示密码');
  });

  it('renders password input as type password by default', () => {
    const html = renderToStaticMarkup(<AdminLoginForm />);

    expect(html).toContain('admin-password');
  });

  it('renders form with correct structure', () => {
    const html = renderToStaticMarkup(<AdminLoginForm />);

    expect(html).toContain('<form');
    expect(html).toContain('autoComplete="username"');
    expect(html).toContain('autoComplete="current-password"');
  });
});
