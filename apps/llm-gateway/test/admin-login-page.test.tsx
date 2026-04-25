import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import AdminLoginPage from '../app/admin/login/page.js';

describe('admin login page', () => {
  it('renders a real password login form for the private admin console', () => {
    const html = renderToStaticMarkup(<AdminLoginPage />);

    expect(html).toContain('type="password"');
    expect(html).toContain('name="password"');
    expect(html).toContain('登录');
    expect(html).not.toContain('LLM_GATEWAY_ADMIN_SESSION_TOKEN');
  });
});
