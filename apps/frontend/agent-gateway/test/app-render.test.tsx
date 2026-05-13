import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { App, createGatewayQuerySpecs } from '../src/app/App';
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

  it('declares every Agent Gateway workspace query against backend API methods', () => {
    const apiCalls: string[] = [];
    type QueryApi = Parameters<typeof createGatewayQuerySpecs>[0];
    type QueryApiResult<K extends keyof QueryApi> = Awaited<ReturnType<QueryApi[K]>>;
    const resolveApi = <K extends keyof QueryApi>(
      name: string,
      value: QueryApiResult<K>
    ): Promise<QueryApiResult<K>> => {
      apiCalls.push(name);
      return Promise.resolve(value);
    };
    const api = {
      snapshot: () => resolveApi('snapshot', {} as QueryApiResult<'snapshot'>),
      logs: () => resolveApi('logs', {} as QueryApiResult<'logs'>),
      usage: () => resolveApi('usage', {} as QueryApiResult<'usage'>),
      usageAnalytics: (query: unknown) =>
        resolveApi(`usageAnalytics:${JSON.stringify(query)}`, {} as QueryApiResult<'usageAnalytics'>),
      apiKeys: () => resolveApi('apiKeys', {} as QueryApiResult<'apiKeys'>),
      rawConfig: () => resolveApi('rawConfig', {} as QueryApiResult<'rawConfig'>),
      dashboard: () => resolveApi('dashboard', {} as QueryApiResult<'dashboard'>),
      clients: () => resolveApi('clients', {} as QueryApiResult<'clients'>),
      quotaDetails: () => resolveApi('quotaDetails', {} as QueryApiResult<'quotaDetails'>),
      runtimeHealth: () => resolveApi('runtimeHealth', {} as QueryApiResult<'runtimeHealth'>),
      systemInfo: () => resolveApi('systemInfo', {} as QueryApiResult<'systemInfo'>),
      discoverModels: () => resolveApi('discoverModels', {} as QueryApiResult<'discoverModels'>),
      providerConfigs: () => resolveApi('providerConfigs', {} as QueryApiResult<'providerConfigs'>),
      authFiles: (query: unknown) => resolveApi(`authFiles:${JSON.stringify(query)}`, {} as QueryApiResult<'authFiles'>)
    };

    const queries = createGatewayQuerySpecs(
      api as unknown as Parameters<typeof createGatewayQuerySpecs>[0],
      'access-token',
      true
    );
    queries.forEach(query => void query.queryFn());

    expect(queries.map(query => query.queryKey)).toEqual([
      ['agent-gateway', 'snapshot', 'access-token'],
      ['agent-gateway', 'logs', 'access-token'],
      ['agent-gateway', 'usage', 'access-token'],
      ['agent-gateway', 'usage-analytics', 'access-token'],
      ['agent-gateway', 'api-keys', 'access-token'],
      ['agent-gateway', 'raw-config', 'access-token'],
      ['agent-gateway', 'dashboard', 'access-token'],
      ['agent-gateway', 'clients', 'access-token'],
      ['agent-gateway', 'quota-details', 'access-token'],
      ['agent-gateway', 'runtime-health', 'access-token'],
      ['agent-gateway', 'system-info', 'access-token'],
      ['agent-gateway', 'system-models', 'access-token'],
      ['agent-gateway', 'provider-configs', 'access-token'],
      ['agent-gateway', 'auth-files', 'access-token']
    ]);
    expect(apiCalls).toEqual([
      'snapshot',
      'logs',
      'usage',
      'usageAnalytics:{"range":"today","limit":100}',
      'apiKeys',
      'rawConfig',
      'dashboard',
      'clients',
      'quotaDetails',
      'runtimeHealth',
      'systemInfo',
      'discoverModels',
      'providerConfigs',
      'authFiles:{"limit":100}'
    ]);
    expect(queries.every(query => query.enabled && query.retry === false)).toBe(true);
  });
});
