import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConfigEditorPage } from '../src/app/pages/ConfigEditorPage';
import { LogsManagerPage } from '../src/app/pages/LogsManagerPage';

describe('Agent Gateway workflow controls', () => {
  it('renders save state, confirmation, notification, and unsaved guard affordances on mutable pages', () => {
    const configHtml = renderToStaticMarkup(
      <ConfigEditorPage content="debug: true\n" version="config-1" dirty saving lastMessage="保存中" />
    );
    expect(configHtml).toContain('未保存');
    expect(configHtml).toContain('保存中');

    const logsHtml = renderToStaticMarkup(
      <LogsManagerPage confirmClearLabel="确认清空日志" lastMessage="日志已清空" />
    );
    expect(logsHtml).toContain('确认清空日志');
    expect(logsHtml).toContain('日志已清空');
  });
});
