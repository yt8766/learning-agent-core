import { describe, expect, it } from 'vitest';

import chatHomePageSource from '../../../src/pages/chat-home/chat-home-page.tsx?raw';

describe('chat-home-page report schema absence', () => {
  it('does not embed the report schema workbench into the chat homepage', () => {
    expect(chatHomePageSource).not.toContain("from '@/features/report-schema/report-schema-workbench'");
    expect(chatHomePageSource).not.toContain('<ReportSchemaWorkbench />');
  });
});
