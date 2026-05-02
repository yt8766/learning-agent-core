import { describe, expect, it } from 'vitest';

import {
  buildCognitionSummary,
  buildMainThreadMessages,
  buildNodeStreamCognitionSummary,
  containsCitationSection,
  extractThinkBlocks,
  findSuffixPrefixOverlap,
  formatConnectorTemplateLabel,
  mergeAssistantText,
  normalizeCapabilityMessageForMainThread,
  parseAssistantThinkingContent,
  stripStreamingCursor,
  stripThinkTags,
  toPlainSummary
} from '@/pages/chat/chat-message-adapter-helpers';
import type { ChatMessageRecord } from '@/types/chat';

describe('chat-message-adapter helpers', () => {
  it('会清洗认知摘要里的六部/工作流前缀并截断过长句子', () => {
    expect(
      buildCognitionSummary(
        '首辅视角：workflow 当前仍由首辅统一协调全局。这里还有一段会被截断的额外说明，用于验证摘要长度。'
      )
    ).toBe('正在统筹这轮处理');
  });

  it('会把节点流状态拼成摘要，并在没有有效内容时返回 undefined', () => {
    expect(
      buildNodeStreamCognitionSummary({
        nodeLabel: '工部',
        detail: '正在修复测试',
        progressPercent: 60
      })
    ).toBe('工部 · 正在修复测试 · 进度 60%');
    expect(buildNodeStreamCognitionSummary({})).toBeUndefined();
  });

  it('会把数字转换为纯文本摘要，并忽略其他值', () => {
    expect(toPlainSummary(42)).toBe('42');
    expect(toPlainSummary('text')).toBe('text');
    expect(toPlainSummary({})).toBeUndefined();
  });

  it('会把 skill 建议归一化成 control notice，并区分 pending/installed/connector fallback', () => {
    const pending = normalizeCapabilityMessageForMainThread({
      id: 'skill-pending',
      sessionId: 'session-1',
      role: 'system',
      content: 'pending',
      createdAt: '2026-04-08T00:00:00.000Z',
      card: {
        type: 'skill_suggestions',
        capabilityGapDetected: true,
        status: 'suggested',
        safetyNotes: [],
        suggestions: [
          {
            id: 'skill-1',
            kind: 'remote-skill',
            displayName: 'repo-inspector',
            summary: 'Inspect repo',
            score: 0.9,
            availability: 'installable-remote',
            reason: 'gap',
            requiredCapabilities: [],
            installState: {
              receiptId: 'receipt-1',
              status: 'pending'
            }
          }
        ]
      }
    });
    expect(pending.card?.type).toBe('control_notice');
    expect(pending.content).toContain('等待安装 repo-inspector');

    const installed = normalizeCapabilityMessageForMainThread({
      id: 'skill-installed',
      sessionId: 'session-1',
      role: 'system',
      content: 'installed',
      createdAt: '2026-04-08T00:00:00.000Z',
      card: {
        type: 'skill_suggestions',
        capabilityGapDetected: true,
        status: 'auto-installed',
        safetyNotes: [],
        suggestions: [
          {
            id: 'skill-2',
            kind: 'remote-skill',
            displayName: 'repo-inspector',
            summary: 'Inspect repo',
            score: 0.9,
            availability: 'installable-remote',
            reason: 'gap',
            requiredCapabilities: [],
            installState: {
              receiptId: 'receipt-2',
              status: 'installed'
            }
          }
        ]
      }
    });
    expect(installed.content).toContain('已自动补齐 repo-inspector');

    const connector = normalizeCapabilityMessageForMainThread({
      id: 'skill-connector',
      sessionId: 'session-1',
      role: 'system',
      content: 'connector',
      createdAt: '2026-04-08T00:00:00.000Z',
      card: {
        type: 'skill_suggestions',
        capabilityGapDetected: true,
        status: 'blocked',
        safetyNotes: [],
        mcpRecommendation: {
          kind: 'connector',
          summary: 'need browser',
          reason: 'missing connector',
          connectorTemplateId: 'browser-mcp-template'
        },
        suggestions: []
      }
    });
    expect(connector.content).toContain('Browser MCP');
  });

  it('会把 worker dispatch 和 skill reuse 归一化为主线程提示', () => {
    const dispatch = normalizeCapabilityMessageForMainThread({
      id: 'dispatch',
      sessionId: 'session-1',
      role: 'system',
      content: 'dispatch',
      createdAt: '2026-04-08T00:00:00.000Z',
      card: {
        type: 'worker_dispatch',
        currentMinistry: '工部',
        currentWorker: 'code-worker',
        usedInstalledSkills: [],
        usedCompanyWorkers: []
      }
    });
    expect(dispatch.content).toContain('工部');
    expect(dispatch.content).toContain('code-worker');

    const reuse = normalizeCapabilityMessageForMainThread({
      id: 'reuse',
      sessionId: 'session-1',
      role: 'system',
      content: 'reuse',
      createdAt: '2026-04-08T00:00:00.000Z',
      card: {
        type: 'skill_reuse',
        reusedSkills: [],
        usedInstalledSkills: ['find-skills'],
        usedCompanyWorkers: ['reviewer']
      }
    });
    expect(reuse.content).toContain('find-skills、reviewer');
  });

  it('会保留认知锚点消息，并过滤已经有正式结果的 pending assistant', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'pending_assistant_session-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '',
        createdAt: 'invalid-date'
      },
      {
        id: 'assistant-final',
        sessionId: 'session-1',
        role: 'assistant',
        content: '正式回复',
        createdAt: '2026-04-08T00:00:01.000Z'
      }
    ];

    expect(buildMainThreadMessages(messages).map(message => message.id)).toEqual(['assistant-final']);
    expect(buildMainThreadMessages(messages, 'pending_assistant_session-1').map(message => message.id)).toEqual([
      'assistant-final'
    ]);
  });

  it('会把未落库的 transient stream 作为认知锚点保留，并清空其正文', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'progress_stream_task-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: 'streaming text',
        createdAt: '2026-04-08T00:00:00.000Z'
      }
    ];

    const mainThread = buildMainThreadMessages(messages, 'progress_stream_task-1');

    expect(mainThread).toHaveLength(1);
    expect(mainThread[0]?.id).toBe('progress_stream_task-1');
    expect(mainThread[0]?.content).toBe('');
  });

  it('会合并高重叠 assistant 文本，并在低重叠时追加分段', () => {
    const overlapCore = '用来验证消息拼接时的后缀前缀重叠逻辑已经生效并且长度足够长';
    const overlapLeft = `这是一段很长的重叠文本，${overlapCore}`;
    const overlapRight = `${overlapCore}，并继续补完最终结论`;
    expect(findSuffixPrefixOverlap(overlapLeft, overlapRight)).toBeGreaterThanOrEqual(24);
    expect(mergeAssistantText(overlapLeft, overlapRight)).toContain('并继续补完最终结论');
    expect(mergeAssistantText('第一段', '第二段')).toBe('第一段\n\n第二段');
  });

  it('会识别引用来源段落、格式化 connector 标签并去掉流式光标', () => {
    expect(containsCitationSection('结论\n\n引用来源:\n1. docs')).toBe(true);
    expect(formatConnectorTemplateLabel('lark-mcp-template')).toBe('Lark MCP');
    expect(formatConnectorTemplateLabel()).toBe('相关 MCP');
    expect(stripStreamingCursor('正在输出▌')).toBe('正在输出');
  });

  it('stripThinkTags 剥离 <think>…</think> 块，保留正文内容', () => {
    expect(stripThinkTags('<think>这里是推理过程</think>这是最终回复')).toBe('这是最终回复');
    expect(stripThinkTags('<think>\n多行\n推理\n</think>\n\n正文段落')).toBe('正文段落');
    expect(stripThinkTags('没有 think 标签的纯文本')).toBe('没有 think 标签的纯文本');
    expect(stripThinkTags('<think>推理</think>')).toBe('');
  });

  it('parseAssistantThinkingContent splits completed think blocks from visible content', () => {
    expect(parseAssistantThinkingContent('<think>先判断概念边界</think>镜像是模板。', false)).toEqual({
      visibleContent: '镜像是模板。',
      thinkContent: '先判断概念边界',
      thinkingState: 'completed',
      hasMalformedThink: false
    });
  });

  it('parseAssistantThinkingContent hides unfinished streaming think content', () => {
    expect(parseAssistantThinkingContent('<think>正在整理 Docker 类比', true)).toEqual({
      visibleContent: '',
      thinkContent: '正在整理 Docker 类比',
      thinkingState: 'streaming',
      hasMalformedThink: true
    });
  });

  it('parseAssistantThinkingContent protects visible content when think is malformed after completion', () => {
    expect(parseAssistantThinkingContent('正文之前\n<think>未闭合思考', false)).toEqual({
      visibleContent: '正文之前',
      thinkContent: '未闭合思考',
      thinkingState: 'completed',
      hasMalformedThink: true
    });
  });

  it('stripThinkTags removes unfinished think blocks as a display safety fallback', () => {
    expect(stripThinkTags('答案\n<think>内部推理')).toBe('答案');
  });

  it('extractThinkBlocks 提取所有 <think>…</think> 内容并拼接', () => {
    expect(extractThinkBlocks('<think>推理一</think>正文<think>推理二</think>')).toBe('推理一\n\n推理二');
    expect(extractThinkBlocks('<think>  唯一推理  </think>结论')).toBe('唯一推理');
    expect(extractThinkBlocks('没有 think 标签')).toBe('');
  });
});
