import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';

import { ActionIntent } from '@agent/core';

import {
  normalizeFeishuWebhook,
  normalizeTelegramWebhook,
  parseActionIntent,
  parseGatewayCommand,
  verifyFeishuWebhook,
  verifyTelegramWebhook
} from '../../src/message-gateway/message-gateway-normalizer';

describe('message-gateway-normalizer', () => {
  afterEach(() => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
    delete process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN;
    delete process.env.FEISHU_WEBHOOK_SIGNATURE;
  });

  it('parses gateway commands and falls back to external api intent for unknown values', () => {
    expect(parseGatewayCommand('/approve task-1 write_file')).toEqual({
      rawCommand: '/approve',
      args: ['task-1', 'write_file']
    });
    expect(parseGatewayCommand(undefined)).toEqual({
      rawCommand: undefined,
      args: []
    });
    expect(parseActionIntent('WRITE_FILE')).toBe(ActionIntent.WRITE_FILE);
    expect(parseActionIntent('something-else')).toBe(ActionIntent.CALL_EXTERNAL_API);
  });

  it('verifies telegram webhook secret token case-insensitively from headers', () => {
    process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = 'secret-token';

    expect(() =>
      verifyTelegramWebhook({
        'X-Telegram-Bot-Api-Secret-Token': ['secret-token']
      })
    ).not.toThrow();

    expect(() =>
      verifyTelegramWebhook({
        'x-telegram-bot-api-secret-token': 'wrong-token'
      })
    ).toThrowError(new UnauthorizedException('Invalid telegram webhook secret token'));
  });

  it('verifies feishu token and signature using both root and header payload forms', () => {
    process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN = 'verify-token';
    process.env.FEISHU_WEBHOOK_SIGNATURE = 'sign-value';

    expect(() =>
      verifyFeishuWebhook(
        {
          header: {
            token: 'verify-token'
          }
        },
        {
          'X-Lark-Signature': 'sign-value'
        }
      )
    ).not.toThrow();

    expect(() =>
      verifyFeishuWebhook(
        {
          token: 'wrong-token'
        },
        {
          'x-lark-signature': 'sign-value'
        }
      )
    ).toThrowError(new UnauthorizedException('Invalid feishu webhook verification token'));

    expect(() =>
      verifyFeishuWebhook(
        {
          token: 'verify-token'
        },
        {
          'x-lark-signature': 'wrong-sign'
        }
      )
    ).toThrowError(new UnauthorizedException('Invalid feishu webhook signature'));
  });

  it('normalizes telegram webhook messages from edited payloads and trims command text', () => {
    const message = normalizeTelegramWebhook({
      update_id: 42,
      edited_message: {
        message_id: 7,
        text: '   /status   ',
        from: {
          id: 123,
          username: 'telegram-user'
        },
        chat: {
          id: 456
        }
      }
    });

    expect(message).toEqual({
      channel: 'telegram',
      channelUserId: '123',
      channelChatId: '456',
      messageId: '7',
      text: '/status',
      command: '/status',
      identity: {
        channel: 'telegram',
        channelUserId: '123',
        channelChatId: '456',
        messageId: '7',
        displayName: 'telegram-user'
      }
    });
  });

  it('normalizes feishu webhook messages from event and fallback message payloads', () => {
    const fromEvent = normalizeFeishuWebhook({
      event: {
        sender: {
          sender_id: {
            open_id: 'open-user'
          },
          sender_type: 'user'
        },
        message: {
          chat_id: 'chat-event',
          message_id: 'msg-event',
          content: JSON.stringify({
            text: '  /approve task-1 write_file '
          })
        }
      }
    });

    const fromFallbackMessage = normalizeFeishuWebhook({
      message: {
        chatId: 'chat-fallback',
        messageId: 'msg-fallback',
        content: 'plain text body'
      }
    });

    expect(fromEvent).toEqual({
      channel: 'feishu',
      channelUserId: 'open-user',
      channelChatId: 'chat-event',
      messageId: 'msg-event',
      text: '/approve task-1 write_file',
      command: '/approve task-1 write_file',
      identity: {
        channel: 'feishu',
        channelUserId: 'open-user',
        channelChatId: 'chat-event',
        messageId: 'msg-event',
        displayName: 'user'
      }
    });
    expect(fromFallbackMessage).toEqual({
      channel: 'feishu',
      channelUserId: 'unknown',
      channelChatId: 'chat-fallback',
      messageId: 'msg-fallback',
      text: 'plain text body',
      command: undefined,
      identity: {
        channel: 'feishu',
        channelUserId: 'unknown',
        channelChatId: 'chat-fallback',
        messageId: 'msg-fallback',
        displayName: undefined
      }
    });
  });
});
