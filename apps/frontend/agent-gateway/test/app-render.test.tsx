import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../src/app/App';
import { LoginPage } from '../src/app/pages/LoginPage';
describe('Agent Gateway app shell', () => {
  it('renders Chinese recovery state before auth is restored', () => {
    const queryClient = new QueryClient();

    expect(
      renderToStaticMarkup(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/gateway']}>
            <App />
          </MemoryRouter>
        </QueryClientProvider>
      )
    ).toContain('正在恢复会话');
  });

  it('does not prefill local development credentials on the login form', () => {
    const html = renderToStaticMarkup(<LoginPage onLogin={async () => undefined} />);

    expect(html).toContain('AGENT');
    expect(html).toContain('GATEWAY');
    expect(html).toContain('API');
    expect(html).toContain('Agent Gateway Management Center');
    expect(html).toContain('管理密钥:');
    expect(html).toContain('请输入管理密钥');
    expect(html).toContain('记住密码');
    expect(html).not.toContain('当前地址');
    expect(html).not.toContain('自定义连接地址:');
    expect(html).not.toContain('中文');
    expect(html).not.toContain('admin123');
    expect(html).not.toContain('value="admin"');
  });
});
