import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ExceptionPage, ForbiddenPage, NotFoundPage, ServerErrorPage } from '../../../src/pages/exceptions';

describe('knowledge exception pages', () => {
  it('renders the Ant Design Pro style 403 page contract', () => {
    const html = renderToStaticMarkup(<ForbiddenPage />);

    expect(html).toContain('knowledge-pro-exception');
    expect(html).toContain('403');
    expect(html).toContain('Sorry, you are not authorized to access this page.');
    expect(html).toContain('Back to home');
    expect(html).toContain('/pro-exception-assets/403.svg');
  });

  it('renders the Ant Design Pro style 404 page contract', () => {
    const html = renderToStaticMarkup(<NotFoundPage />);

    expect(html).toContain('knowledge-pro-exception');
    expect(html).toContain('404');
    expect(html).toContain('抱歉，您访问的页面不存在。');
    expect(html).toContain('返回首页');
    expect(html).toContain('/pro-exception-assets/404.svg');
  });

  it('renders the Ant Design Pro style 500 page contract', () => {
    const html = renderToStaticMarkup(<ServerErrorPage />);

    expect(html).toContain('knowledge-pro-exception');
    expect(html).toContain('500');
    expect(html).toContain('Sorry, something went wrong.');
    expect(html).toContain('Back Home');
    expect(html).toContain('/pro-exception-assets/500.svg');
  });

  it('supports route-level preset rendering through the shared ExceptionPage type prop', () => {
    const html = renderToStaticMarkup(<ExceptionPage type="404" />);

    expect(html).toContain('404');
    expect(html).toContain('抱歉，您访问的页面不存在。');
    expect(html).toContain('返回首页');
  });
});
