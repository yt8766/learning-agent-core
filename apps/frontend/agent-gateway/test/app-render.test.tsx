import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app/App';
import { LoginPage } from '../src/app/pages/LoginPage';
describe('Agent Gateway app shell', () => {
  it('renders Chinese recovery state before auth is restored', () => {
    expect(renderToStaticMarkup(<App />)).toContain('正在恢复会话');
  });

  it('does not prefill local development credentials on the login form', () => {
    const html = renderToStaticMarkup(<LoginPage onLogin={async () => undefined} />);

    expect(html).not.toContain('admin123');
    expect(html).not.toContain('value="admin"');
  });
});
