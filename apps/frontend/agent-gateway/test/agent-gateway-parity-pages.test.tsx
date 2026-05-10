import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConfirmDialog } from '../src/app/components/ConfirmDialog';
import { NotificationCenter } from '../src/app/components/NotificationCenter';
import { ApiKeysPage } from '../src/app/pages/ApiKeysPage';
import { ConfigEditorPage } from '../src/app/pages/ConfigEditorPage';
import { ConnectionPage } from '../src/app/pages/ConnectionPage';
import { LogsManagerPage } from '../src/app/pages/LogsManagerPage';
import { SystemPage } from '../src/app/pages/SystemPage';

describe('Agent Gateway CLI Proxy parity pages', () => {
  it('renders connection management controls', () => {
    const html = renderToStaticMarkup(<ConnectionPage />);

    expect(html).toContain('Management API');
    expect(html).toContain('保存连接');
    expect(html).toContain('测试连接');
  });

  it('renders raw config editor controls', () => {
    const html = renderToStaticMarkup(<ConfigEditorPage content={'debug: true\n'} version="config-1" />);

    expect(html).toContain('config.yaml');
    expect(html).toContain('保存配置');
    expect(html).toContain('查看差异');
    expect(html).toContain('重新加载');
  });

  it('renders masked proxy API keys and mutation controls', () => {
    const html = renderToStaticMarkup(
      <ApiKeysPage
        items={[
          {
            id: 'proxy-key-0',
            name: 'Proxy key 1',
            prefix: 'sk-***abc',
            status: 'active',
            scopes: ['proxy:invoke'],
            createdAt: '2026-05-08T00:00:00.000Z',
            lastUsedAt: null,
            expiresAt: null,
            usage: { requestCount: 0, lastRequestAt: null }
          }
        ]}
      />
    );

    expect(html).toContain('API Keys');
    expect(html).toContain('sk-***abc');
    expect(html).toContain('替换全部');
    expect(html).toContain('更新');
    expect(html).toContain('删除');
  });

  it('renders log tail, search, clear, and download controls', () => {
    const html = renderToStaticMarkup(<LogsManagerPage />);

    expect(html).toContain('Logs Manager');
    expect(html).toContain('搜索日志');
    expect(html).toContain('隐藏管理流量');
    expect(html).toContain('清空日志');
    expect(html).toContain('下载错误日志');
  });

  it('renders system version, quick links, and grouped models', () => {
    const html = renderToStaticMarkup(
      <SystemPage
        info={{
          version: '1.2.3',
          buildDate: '2026-05-01',
          latestVersion: '1.2.4',
          updateAvailable: true,
          links: { help: 'https://help.router-for.me/' }
        }}
        modelGroups={[
          {
            providerId: 'openai',
            providerKind: 'openai-compatible',
            models: [{ id: 'gpt-5.4', displayName: 'gpt-5.4', providerKind: 'openai-compatible', available: true }]
          }
        ]}
      />
    );

    expect(html).toContain('管理中心信息');
    expect(html).toContain('1.2.3');
    expect(html).toContain('检查最新版本');
    expect(html).toContain('gpt-5.4');
  });

  it('renders confirmation and notification workflow surfaces', () => {
    expect(
      renderToStaticMarkup(
        <ConfirmDialog title="删除 Provider" message="确认删除 openai-main?" confirmLabel="删除" cancelLabel="取消" />
      )
    ).toContain('确认删除 openai-main?');

    expect(
      renderToStaticMarkup(<NotificationCenter items={[{ id: 'notice-1', level: 'success', message: '保存成功' }]} />)
    ).toContain('保存成功');
  });
});
