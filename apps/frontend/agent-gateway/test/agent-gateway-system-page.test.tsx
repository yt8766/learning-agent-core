import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SystemPage } from '../src/app/pages/SystemPage';

describe('SystemPage', () => {
  it('renders latest version, request-log, and local login cleanup controls', () => {
    const html = renderToStaticMarkup(
      <SystemPage
        info={{
          version: '1.2.3',
          buildDate: '2026-05-01',
          latestVersion: '1.2.4',
          updateAvailable: true,
          links: { help: 'https://help.router-for.me/' }
        }}
        modelGroups={[]}
      />
    );

    expect(html).toContain('管理中心信息');
    expect(html).toContain('system-info-clone');
    expect(html).toContain('system-about-card');
    expect(html).toContain('system-info-grid');
    expect(html).toContain('Agent Gateway Management Center');
    expect(html).toContain('检查最新版本');
    expect(html).toContain('启用请求日志');
    expect(html).toContain('清理本地登录态');
    expect(html).toContain('learning-agent-core');
    expect(html).toContain('帮助文档');
    expect(html).toContain('前端源码');
    expect(html).toContain('https://github.com/yt8766/learning-agent-core');
  });
});
