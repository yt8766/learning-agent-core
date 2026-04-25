import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import AdminPage from '../app/admin/page.js';
import { AdminAuthGate } from '../src/admin/admin-auth-gate.js';

describe('admin page auth gate', () => {
  it('wraps the dashboard shell in the browser token gate', async () => {
    const element = await AdminPage();

    expect(element.type).toBe(AdminAuthGate);
  });

  it('renders the gateway dashboard shell after the browser token gate', async () => {
    const element = await AdminPage();
    const html = renderToStaticMarkup(element.props.children);

    expect(html).toContain('大模型网关');
    expect(html).toContain('运行中枢');
    expect(html).toContain('模型中枢');
    expect(html).toContain('服务商中枢');
    expect(html).toContain('今日请求');
    expect(html).toContain('平均延迟');
    expect(html).toContain('退出登录');
    expect(html).toContain('data-sidebar="sidebar"');
    expect(html).toContain('shadow-none');
    expect(html).not.toContain('border-black');
    expect(html).not.toContain('Add Model');
    expect(html).not.toContain('Provider Health');
    expect(html).not.toContain('Today requests');
    expect(html).not.toContain('Average latency');
    expect(html).not.toContain('Acme Inc.');
    expect(html).not.toContain('Total Revenue');
    expect(html).not.toContain('Admin 控制台');
  });
});
