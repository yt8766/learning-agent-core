import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app/App';
describe('Agent Gateway app shell', () => {
  it('renders Chinese recovery state before auth is restored', () => {
    expect(renderToStaticMarkup(<App />)).toContain('正在恢复会话');
  });
});
