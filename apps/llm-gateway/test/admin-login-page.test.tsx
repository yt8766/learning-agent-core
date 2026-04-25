import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import AdminLoginPage from '../app/admin/login/page.js';

describe('admin login page', () => {
  it('renders the shadcn login form template with local components', () => {
    const html = renderToStaticMarkup(<AdminLoginPage />);

    expect(html).toContain('data-slot="card"');
    expect(html).toContain('data-slot="card-description"');
    expect(html).toContain('data-slot="field-group"');
    expect(html).toContain('data-slot="field"');
    expect(html).toContain('data-slot="field-label"');
    expect(html).toContain('data-slot="field-description"');
    expect(html.match(/data-slot="input"/g)).toHaveLength(2);
    expect(html.match(/data-slot="field"/g)).toHaveLength(3);
    expect(html.match(/data-slot="field-label"/g)).toHaveLength(2);
    expect(html).toContain('data-slot="button"');
    expect(html).toContain('autoComplete="off"');
    expect(html).toContain('登录到管理员账号');
    expect(html).toContain('输入管理员账号和密码进入私有网关控制台');
    expect(html).toContain('for="admin-account"');
    expect(html).toContain('id="admin-account"');
    expect(html).toContain('type="text"');
    expect(html).toContain('name="adminAccount"');
    expect(html).toContain('value=""');
    expect(html).toContain('for="admin-password"');
    expect(html).toContain('id="admin-password"');
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="new-password"');
    expect(html).toContain('name="password"');
    expect(html).toContain('aria-label="显示密码"');
    expect(html).toContain('type="button"');
    expect(html).toContain('默认账号 admin');
    expect(html).not.toContain('autoComplete="username"');
    expect(html).not.toContain('autoComplete="current-password"');
    expect(html).not.toContain('name="username"');
    expect(html).not.toContain('placeholder="admin"');
    expect(html).toContain('登录');
    expect(html).toContain('此后台不开放注册');
    expect(html).not.toContain('Login with Google');
    expect(html).not.toContain('Forgot your password?');
    expect(html).not.toContain('LLM_GATEWAY_ADMIN_SESSION_TOKEN');
  });
});
