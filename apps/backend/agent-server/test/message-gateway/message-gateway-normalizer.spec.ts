import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';

import {
  parseGatewayCommand,
  parseActionIntent,
  verifyTelegramWebhook,
  verifyFeishuWebhook,
  normalizeTelegramWebhook,
  normalizeFeishuWebhook
} from '../../src/message-gateway/message-gateway-normalizer';

describe('parseGatewayCommand', () => {
  it('parses command and args from string', () => {
    expect(parseGatewayCommand('/help arg1 arg2')).toEqual({ rawCommand: '/help', args: ['arg1', 'arg2'] });
  });

  it('handles empty command', () => {
    expect(parseGatewayCommand('')).toEqual({ rawCommand: undefined, args: [] });
  });

  it('handles undefined command', () => {
    expect(parseGatewayCommand(undefined)).toEqual({ rawCommand: undefined, args: [] });
  });

  it('handles single command with no args', () => {
    expect(parseGatewayCommand('/start')).toEqual({ rawCommand: '/start', args: [] });
  });

  it('filters empty segments from whitespace', () => {
    expect(parseGatewayCommand('cmd   arg1  ')).toEqual({ rawCommand: 'cmd', args: ['arg1'] });
  });
});

describe('parseActionIntent', () => {
  it('returns matching ActionIntent value', () => {
    const result = parseActionIntent('CALL_EXTERNAL_API');
    expect(result).toBe('call_external_api');
  });

  it('falls back to CALL_EXTERNAL_API for unknown intent', () => {
    const result = parseActionIntent('unknown_action');
    expect(result).toBe('call_external_api');
  });

  it('normalizes case', () => {
    const result = parseActionIntent('call_external_api');
    expect(result).toBe('call_external_api');
  });
});

describe('verifyTelegramWebhook', () => {
  it('does nothing when TELEGRAM_WEBHOOK_SECRET_TOKEN is not set', () => {
    const original = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
    delete process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
    try {
      expect(() => verifyTelegramWebhook()).not.toThrow();
    } finally {
      if (original !== undefined) process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = original;
    }
  });

  it('does nothing when token matches', () => {
    const original = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = 'secret';
    try {
      expect(() => verifyTelegramWebhook({ 'x-telegram-bot-api-secret-token': 'secret' })).not.toThrow();
    } finally {
      if (original !== undefined) process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = original;
      else delete process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
    }
  });

  it('throws when token does not match', () => {
    const original = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = 'secret';
    try {
      expect(() => verifyTelegramWebhook({ 'x-telegram-bot-api-secret-token': 'wrong' })).toThrow(
        UnauthorizedException
      );
    } finally {
      if (original !== undefined) process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = original;
      else delete process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
    }
  });

  it('throws when headers are missing and token is expected', () => {
    const original = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = 'secret';
    try {
      expect(() => verifyTelegramWebhook(undefined)).toThrow(UnauthorizedException);
    } finally {
      if (original !== undefined) process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = original;
      else delete process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
    }
  });

  it('handles header values as arrays', () => {
    const original = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = 'secret';
    try {
      expect(() => verifyTelegramWebhook({ 'x-telegram-bot-api-secret-token': ['secret'] })).not.toThrow();
    } finally {
      if (original !== undefined) process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = original;
      else delete process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
    }
  });
});

describe('verifyFeishuWebhook', () => {
  it('does nothing when no env vars are set', () => {
    const origToken = process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN;
    const origSig = process.env.FEISHU_WEBHOOK_SIGNATURE;
    delete process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN;
    delete process.env.FEISHU_WEBHOOK_SIGNATURE;
    try {
      expect(() => verifyFeishuWebhook({})).not.toThrow();
    } finally {
      if (origToken !== undefined) process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN = origToken;
      if (origSig !== undefined) process.env.FEISHU_WEBHOOK_SIGNATURE = origSig;
    }
  });

  it('validates token from payload.token', () => {
    const origToken = process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN;
    process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN = 'expected';
    delete process.env.FEISHU_WEBHOOK_SIGNATURE;
    try {
      expect(() => verifyFeishuWebhook({ token: 'wrong' })).toThrow(UnauthorizedException);
      expect(() => verifyFeishuWebhook({ token: 'expected' })).not.toThrow();
    } finally {
      if (origToken !== undefined) process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN = origToken;
      else delete process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN;
    }
  });

  it('validates token from payload.header.token', () => {
    const origToken = process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN;
    process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN = 'expected';
    delete process.env.FEISHU_WEBHOOK_SIGNATURE;
    try {
      expect(() => verifyFeishuWebhook({ header: { token: 'expected' } })).not.toThrow();
      expect(() => verifyFeishuWebhook({ header: { token: 'wrong' } })).toThrow(UnauthorizedException);
    } finally {
      if (origToken !== undefined) process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN = origToken;
      else delete process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN;
    }
  });

  it('validates signature from header', () => {
    const origToken = process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN;
    const origSig = process.env.FEISHU_WEBHOOK_SIGNATURE;
    delete process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN;
    process.env.FEISHU_WEBHOOK_SIGNATURE = 'expected-sig';
    try {
      expect(() => verifyFeishuWebhook({}, { 'x-lark-signature': 'expected-sig' })).not.toThrow();
      expect(() => verifyFeishuWebhook({}, { 'x-lark-signature': 'wrong' })).toThrow(UnauthorizedException);
    } finally {
      if (origToken !== undefined) process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN = origToken;
      else delete process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN;
      if (origSig !== undefined) process.env.FEISHU_WEBHOOK_SIGNATURE = origSig;
      else delete process.env.FEISHU_WEBHOOK_SIGNATURE;
    }
  });
});

describe('normalizeTelegramWebhook', () => {
  it('normalizes a telegram message', () => {
    const result = normalizeTelegramWebhook({
      message: {
        message_id: 123,
        from: { id: 456, username: 'testuser' },
        chat: { id: 789 },
        text: 'hello world'
      }
    } as any);
    expect(result.channel).toBe('telegram');
    expect(result.channelUserId).toBe('456');
    expect(result.channelChatId).toBe('789');
    expect(result.messageId).toBe('123');
    expect(result.text).toBe('hello world');
    expect(result.identity.displayName).toBe('testuser');
  });

  it('handles edited_message', () => {
    const result = normalizeTelegramWebhook({
      edited_message: {
        message_id: 456,
        from: { id: 111 },
        chat: { id: 222 },
        text: 'edited text'
      }
    } as any);
    expect(result.text).toBe('edited text');
  });

  it('uses update_id as fallback messageId', () => {
    const result = normalizeTelegramWebhook({
      update_id: 999,
      message: { from: {}, chat: {} }
    } as any);
    expect(result.messageId).toBe('999');
  });

  it('handles missing message fields gracefully', () => {
    const result = normalizeTelegramWebhook({} as any);
    expect(result.channelUserId).toBe('unknown');
    expect(result.channelChatId).toBe('unknown');
    expect(result.text).toBe('');
  });

  it('extracts command from slash-prefixed text', () => {
    const result = normalizeTelegramWebhook({
      message: { from: { id: 1 }, chat: { id: 2 }, text: '/start arg1' }
    } as any);
    expect(result.command).toBe('/start arg1');
  });

  it('does not set command for non-slash text', () => {
    const result = normalizeTelegramWebhook({
      message: { from: { id: 1 }, chat: { id: 2 }, text: 'hello' }
    } as any);
    expect(result.command).toBeUndefined();
  });

  it('handles non-string text', () => {
    const result = normalizeTelegramWebhook({
      message: { from: { id: 1 }, chat: { id: 2 }, text: 123 }
    } as any);
    expect(result.text).toBe('');
  });
});

describe('normalizeFeishuWebhook', () => {
  it('normalizes a feishu message', () => {
    const result = normalizeFeishuWebhook({
      event: {
        sender: { sender_id: { open_id: 'ou_123' }, sender_type: 'user' },
        message: {
          chat_id: 'oc_456',
          message_id: 'om_789',
          content: '{"text":"hello"}'
        }
      }
    } as any);
    expect(result.channel).toBe('feishu');
    expect(result.channelUserId).toBe('ou_123');
    expect(result.channelChatId).toBe('oc_456');
    expect(result.messageId).toBe('om_789');
    expect(result.text).toBe('hello');
  });

  it('falls back to payload.message when event.message is missing', () => {
    const result = normalizeFeishuWebhook({
      event: { sender: { id: 'sender-1' } },
      message: {
        chatId: 'chat-1',
        messageId: 'msg-1',
        content: '{"text":"fallback"}'
      }
    } as any);
    expect(result.channelChatId).toBe('chat-1');
    expect(result.messageId).toBe('msg-1');
  });

  it('uses unknown for missing chat id', () => {
    const result = normalizeFeishuWebhook({
      event: { sender: { id: 's1' }, message: { content: '{}' } }
    } as any);
    expect(result.channelChatId).toBe('unknown');
  });

  it('handles non-JSON content gracefully', () => {
    const result = normalizeFeishuWebhook({
      event: {
        sender: { id: 's1' },
        message: { chat_id: 'c1', message_id: 'm1', content: 'plain text' }
      }
    } as any);
    expect(result.text).toBe('plain text');
  });

  it('handles empty content', () => {
    const result = normalizeFeishuWebhook({
      event: {
        sender: { id: 's1' },
        message: { chat_id: 'c1', message_id: 'm1', content: '' }
      }
    } as any);
    expect(result.text).toBe('');
  });

  it('handles non-string content', () => {
    const result = normalizeFeishuWebhook({
      event: {
        sender: { id: 's1' },
        message: { chat_id: 'c1', message_id: 'm1', content: 123 }
      }
    } as any);
    expect(result.text).toBe('');
  });

  it('uses Date.now fallback for messageId', () => {
    const result = normalizeFeishuWebhook({
      event: { sender: { id: 's1' }, message: { chat_id: 'c1' } }
    } as any);
    expect(result.messageId).toBeTruthy();
  });

  it('handles missing sender gracefully', () => {
    const result = normalizeFeishuWebhook({
      event: { message: { chat_id: 'c1', message_id: 'm1', content: '{}' } }
    } as any);
    expect(result.channelUserId).toBe('unknown');
  });
});
