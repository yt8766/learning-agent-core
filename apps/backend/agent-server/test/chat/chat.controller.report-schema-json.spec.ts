import { describe, expect, it, vi } from 'vitest';

import { ChatController } from '../../src/chat/chat.controller';

function createResponse() {
  return {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    json: vi.fn()
  };
}

describe('ChatController report-schema JSON compatibility', () => {
  it('returns a plain JSON report-schema payload when the caller accepts application/json', async () => {
    const chatService = {
      resolveDirectResponseMode: vi.fn(() => 'report-schema'),
      streamReportSchema: vi.fn(async (_dto, push) => {
        push({ type: 'schema_ready', data: { bundle: { kind: 'report-bundle' } } });
        return {
          status: 'success',
          content: '{"kind":"report-bundle"}',
          bundle: { kind: 'report-bundle' },
          elapsedMs: 12,
          reportSummaries: [{ reportKey: 'bonusCenterData', status: 'success' }],
          runtime: { executionPath: 'structured-fast-lane' }
        };
      })
    };
    const controller = new ChatController(chatService as never);
    const response = createResponse();

    await controller.streamDirectChat(
      {
        message: '生成 Bonus Center 报表 JSON',
        responseFormat: 'report-schema'
      } as never,
      response as never,
      'application/json'
    );

    expect(response.setHeader).not.toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(response.write).not.toHaveBeenCalled();
    expect(response.end).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({
      content: '{"kind":"report-bundle"}',
      status: 'success',
      bundle: { kind: 'report-bundle' },
      elapsedMs: 12,
      reportSummaries: [{ reportKey: 'bonusCenterData', status: 'success' }],
      runtime: { executionPath: 'structured-fast-lane' },
      events: [{ type: 'schema_ready', data: { bundle: { kind: 'report-bundle' } } }]
    });
  });
});
