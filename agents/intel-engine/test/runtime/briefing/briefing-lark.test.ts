import { describe, expect, it, vi } from 'vitest';

import { sendLarkDigestMessage } from '../../../src/runtime/briefing/briefing-lark';

describe('sendLarkDigestMessage', () => {
  it('Lark 返回业务错误时会从交互卡片降级到 markdown 卡片', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200340,
            msg: 'invalid card payload'
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            msg: 'success'
          }),
          { status: 200 }
        )
      );

    const result = await sendLarkDigestMessage({
      title: 'AI 新技术情报',
      content: '本轮发现 1 条更新',
      card: {
        header: {
          title: {
            tag: 'plain_text',
            content: 'AI 新技术情报'
          }
        },
        elements: [
          {
            tag: 'markdown',
            content: '**interactive**'
          }
        ]
      },
      renderMode: 'dual',
      webhookUrl: 'https://lark.example.com/webhook',
      fetchImpl: fetchImpl as typeof fetch
    });

    expect(result).toEqual({ success: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstPayload = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body ?? '{}')) as {
      card?: { elements?: Array<{ content?: string }> };
    };
    const secondPayload = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body ?? '{}')) as {
      card?: { elements?: Array<{ content?: string }> };
    };
    expect(firstPayload.card?.elements?.[0]?.content).toBe('**interactive**');
    expect(secondPayload.card?.elements?.[0]?.content).toContain('本轮发现 1 条更新');
  });
});
