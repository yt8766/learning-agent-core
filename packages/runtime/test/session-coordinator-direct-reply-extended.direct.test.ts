import { describe, expect, it } from 'vitest';

import { shouldUseSessionDirectReply } from '../src/session/coordinator/session-coordinator-direct-reply';

describe('shouldUseSessionDirectReply (direct)', () => {
  it('returns false for empty message', () => {
    expect(shouldUseSessionDirectReply('')).toBe(false);
    expect(shouldUseSessionDirectReply('   ')).toBe(false);
  });

  it('returns true for simple conversational messages', () => {
    expect(shouldUseSessionDirectReply('Hello')).toBe(true);
    expect(shouldUseSessionDirectReply('What is the weather like?')).toBe(true);
  });

  it('returns false when requestedMode is set', () => {
    expect(shouldUseSessionDirectReply('hello', { requestedMode: 'plan' })).toBe(false);
    expect(shouldUseSessionDirectReply('hello', { requestedMode: 'execute' })).toBe(false);
  });

  it('returns false when imperialDirectIntent is enabled', () => {
    expect(
      shouldUseSessionDirectReply('hello', {
        imperialDirectIntent: { enabled: true, trigger: 'slash-exec' }
      })
    ).toBe(false);
  });

  it('returns false when preferredMode is workflow', () => {
    expect(
      shouldUseSessionDirectReply('hello', {
        requestedHints: { preferredMode: 'workflow' }
      })
    ).toBe(false);
  });

  it('returns false when preferredMode is research-first', () => {
    expect(
      shouldUseSessionDirectReply('hello', {
        requestedHints: { preferredMode: 'research-first' }
      })
    ).toBe(false);
  });

  it('returns false when requestedSkill is set', () => {
    expect(
      shouldUseSessionDirectReply('hello', {
        requestedHints: { requestedSkill: 'test-skill' }
      })
    ).toBe(false);
  });

  it('returns false when requestedConnectorTemplate is set', () => {
    expect(
      shouldUseSessionDirectReply('hello', {
        requestedHints: { requestedConnectorTemplate: 'github-mcp-template' }
      })
    ).toBe(false);
  });

  it('returns false when capabilityAttachments exist', () => {
    expect(
      shouldUseSessionDirectReply('hello', {
        capabilityAttachments: [{ id: 'cap-1' } as any]
      })
    ).toBe(false);
  });

  it('returns false when capabilityAugmentations exist', () => {
    expect(
      shouldUseSessionDirectReply('hello', {
        capabilityAugmentations: [{ id: 'aug-1' } as any]
      })
    ).toBe(false);
  });

  it('returns false for slash commands (not direct-reply)', () => {
    expect(shouldUseSessionDirectReply('/browse something')).toBe(false);
    expect(shouldUseSessionDirectReply('/review code')).toBe(false);
    expect(shouldUseSessionDirectReply('/exec task')).toBe(false);
  });

  it('returns true for /direct-reply slash command', () => {
    expect(shouldUseSessionDirectReply('/direct-reply hello')).toBe(true);
  });

  it('returns false for execution requests in Chinese', () => {
    expect(shouldUseSessionDirectReply('帮我实现这个功能')).toBe(false);
    expect(shouldUseSessionDirectReply('修改一下这段代码')).toBe(false);
    expect(shouldUseSessionDirectReply('修复这个bug')).toBe(false);
    expect(shouldUseSessionDirectReply('重构这个模块')).toBe(false);
    expect(shouldUseSessionDirectReply('新增一个接口')).toBe(false);
    expect(shouldUseSessionDirectReply('优化性能')).toBe(false);
    expect(shouldUseSessionDirectReply('删除这个文件')).toBe(false);
    expect(shouldUseSessionDirectReply('迁移数据库')).toBe(false);
  });

  it('returns false for research/search requests in Chinese', () => {
    expect(shouldUseSessionDirectReply('查资料')).toBe(false);
    expect(shouldUseSessionDirectReply('调研一下')).toBe(false);
    expect(shouldUseSessionDirectReply('检索相关文档')).toBe(false);
    expect(shouldUseSessionDirectReply('搜索最新信息')).toBe(false);
    expect(shouldUseSessionDirectReply('联网搜索')).toBe(false);
  });

  it('returns false for execution requests in English', () => {
    expect(shouldUseSessionDirectReply('implement this feature')).toBe(false);
    expect(shouldUseSessionDirectReply('fix the bug')).toBe(false);
    expect(shouldUseSessionDirectReply('refactor the module')).toBe(false);
    expect(shouldUseSessionDirectReply('add a new endpoint')).toBe(false);
    expect(shouldUseSessionDirectReply('delete the file')).toBe(false);
    expect(shouldUseSessionDirectReply('run the tests')).toBe(false);
    expect(shouldUseSessionDirectReply('build the project')).toBe(false);
    expect(shouldUseSessionDirectReply('deploy to production')).toBe(false);
  });

  it('returns false for Chinese operation requests', () => {
    expect(shouldUseSessionDirectReply('改一下代码')).toBe(false);
    expect(shouldUseSessionDirectReply('加一个功能')).toBe(false);
    expect(shouldUseSessionDirectReply('运行测试')).toBe(false);
    expect(shouldUseSessionDirectReply('发布版本')).toBe(false);
    expect(shouldUseSessionDirectReply('提交代码')).toBe(false);
    expect(shouldUseSessionDirectReply('创建分支')).toBe(false);
    expect(shouldUseSessionDirectReply('开PR')).toBe(false);
    expect(shouldUseSessionDirectReply('安装依赖')).toBe(false);
    expect(shouldUseSessionDirectReply('生成报表')).toBe(false);
    expect(shouldUseSessionDirectReply('写文件')).toBe(false);
    expect(shouldUseSessionDirectReply('改代码')).toBe(false);
  });

  it('returns false for testing requests', () => {
    expect(shouldUseSessionDirectReply('测试一下这个接口')).toBe(false);
    expect(shouldUseSessionDirectReply('联调服务')).toBe(false);
  });

  it('returns true for questions about current state with 现在', () => {
    // 现在 followed by 是什么/是啥/介绍/能做什么 is treated as simple question
    expect(shouldUseSessionDirectReply('现在是什么时间')).toBe(true);
    expect(shouldUseSessionDirectReply('现在是啥情况')).toBe(true);
    expect(shouldUseSessionDirectReply('现在能做什么')).toBe(true);
  });

  it('returns false for questions with 今天 (triggers research detection)', () => {
    // 今天 always triggers research detection
    expect(shouldUseSessionDirectReply('今天天气怎么样')).toBe(false);
  });

  it('handles undefined hints', () => {
    expect(shouldUseSessionDirectReply('hello', undefined)).toBe(true);
  });

  it('handles empty hints object', () => {
    expect(shouldUseSessionDirectReply('hello', {})).toBe(true);
  });
});
