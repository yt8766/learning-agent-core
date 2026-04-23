import type { ContextStrategy } from '@agent/config';
import type { ChatMessageRecord, ChatSessionRecord, ILLMProvider as LlmProvider } from '@agent/core';

import {
  createHeuristicConversationSummary,
  formatCompressionSummaryText,
  normalizeMessageSnippet,
  parseStructuredCompressionSummary,
  truncateSummary
} from './session-compression-helpers';
import { generateTextWithRetry } from '../utils/llm-retry';

export {
  createHeuristicConversationSummary,
  formatCompressionSummaryText,
  normalizeMessageSnippet,
  parseStructuredCompressionSummary,
  truncateSummary
} from './session-compression-helpers';
export type { HeuristicCompressionResult } from './session-compression-helpers';

const DEFAULT_RECENT_MESSAGES_TO_KEEP = 5;
const DEFAULT_LEADING_MESSAGES_TO_KEEP = 10;
const COMPRESSION_TRIGGER_COUNT = 15;
const COMPRESSION_TRIGGER_CHAR_COUNT = 3600;
const MAX_SUMMARY_CHARS = 1200;
const PREVIEW_MESSAGE_COUNT = 3;

interface ConversationCompressionResult {
  summary: string;
  periodOrTopic?: string;
  focuses?: string[];
  keyDeliverables?: string[];
  risks?: string[];
  nextActions?: string[];
  supportingFacts?: string[];
  decisionSummary?: string;
  confirmedPreferences?: string[];
  openLoops?: string[];
  source: 'heuristic' | 'llm';
}

export type { ConversationCompressionResult };

export async function compressConversationIfNeeded(
  llm: LlmProvider,
  contextStrategy: ContextStrategy | undefined,
  session: ChatSessionRecord,
  messages: ChatMessageRecord[],
  onCompacted: (payload: Record<string, unknown>) => void,
  latestUserInput?: string
): Promise<boolean> {
  if (contextStrategy?.compressionEnabled === false) {
    return false;
  }

  const keepRecentMessages = Math.max(
    1,
    contextStrategy?.compressionKeepRecentMessages ?? DEFAULT_RECENT_MESSAGES_TO_KEEP
  );
  const keepLeadingMessages = Math.max(
    0,
    contextStrategy?.compressionKeepLeadingMessages ?? DEFAULT_LEADING_MESSAGES_TO_KEEP
  );
  const baseCompressionMessageThreshold = Math.max(
    keepRecentMessages + 1,
    contextStrategy?.compressionMessageThreshold ?? COMPRESSION_TRIGGER_COUNT
  );
  const compressionProfile = deriveCompressionProfile(latestUserInput);
  const compressionMessageThreshold = Math.max(
    keepRecentMessages + 1,
    baseCompressionMessageThreshold + compressionProfile.thresholdAdjustment
  );
  const condensedCount = session.compression?.condensedMessageCount ?? 0;
  const nextCondensedCount = messages.length - keepRecentMessages;
  const totalCharacterCount = messages.reduce((sum, message) => sum + message.content.length, 0);

  if (nextCondensedCount <= condensedCount) {
    return false;
  }

  const trigger =
    messages.length >= compressionMessageThreshold
      ? 'message_count'
      : totalCharacterCount >= COMPRESSION_TRIGGER_CHAR_COUNT
        ? 'character_count'
        : undefined;

  if (!trigger) {
    return false;
  }

  const leadingMessages = keepLeadingMessages > 0 ? messages.slice(0, keepLeadingMessages) : [];
  const trailingBoundary = Math.max(keepLeadingMessages, nextCondensedCount);
  const messagesToCondense = [...leadingMessages, ...messages.slice(keepLeadingMessages, trailingBoundary)];
  const condensedCharacterCount = messagesToCondense.reduce((sum, message) => sum + message.content.length, 0);
  const compressed = await createConversationSummary(
    llm,
    messagesToCondense,
    contextStrategy?.compressionMaxSummaryChars ?? MAX_SUMMARY_CHARS
  );
  const previewMessages = buildCompressionPreviewMessages(messagesToCondense);

  session.compression = {
    summary: compressed.summary,
    periodOrTopic: compressed.periodOrTopic,
    focuses: compressed.focuses,
    keyDeliverables: compressed.keyDeliverables,
    risks: compressed.risks,
    nextActions: compressed.nextActions,
    supportingFacts: compressed.supportingFacts,
    decisionSummary: compressed.decisionSummary,
    confirmedPreferences: compressed.confirmedPreferences,
    openLoops: compressed.openLoops,
    condensedMessageCount: nextCondensedCount,
    condensedCharacterCount,
    totalCharacterCount,
    previewMessages,
    trigger,
    source: compressed.source,
    summaryLength: compressed.summary.length,
    heuristicFallback: compressed.source === 'heuristic',
    effectiveThreshold: compressionMessageThreshold,
    compressionProfile: compressionProfile.profile,
    updatedAt: new Date().toISOString()
  };
  session.updatedAt = new Date().toISOString();

  onCompacted({
    condensedMessageCount: nextCondensedCount,
    condensedCharacterCount,
    totalCharacterCount,
    previewMessages,
    recentMessageCount: keepRecentMessages,
    trigger,
    summary: compressed.summary,
    periodOrTopic: compressed.periodOrTopic,
    focuses: compressed.focuses,
    keyDeliverables: compressed.keyDeliverables,
    risks: compressed.risks,
    nextActions: compressed.nextActions,
    supportingFacts: compressed.supportingFacts,
    decisionSummary: compressed.decisionSummary,
    confirmedPreferences: compressed.confirmedPreferences,
    openLoops: compressed.openLoops,
    source: compressed.source,
    summaryLength: compressed.summary.length,
    heuristicFallback: compressed.source === 'heuristic',
    effectiveThreshold: compressionMessageThreshold,
    compressionProfile: compressionProfile.profile
  });

  return true;
}

function deriveCompressionProfile(latestUserInput?: string) {
  const normalized = latestUserInput?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return {
      profile: 'default',
      thresholdAdjustment: 0
    } as const;
  }
  if (/(review|审查|代码审阅|复查|排查|诊断|测试|发布|learning|学习|research|研究)/i.test(normalized)) {
    return {
      profile: 'long-flow',
      thresholdAdjustment: -4
    } as const;
  }
  if (/(简单问答|quick|brief|一句话|直接回答)/i.test(normalized)) {
    return {
      profile: 'light-chat',
      thresholdAdjustment: 2
    } as const;
  }
  return {
    profile: 'default',
    thresholdAdjustment: 0
  } as const;
}

async function createConversationSummary(
  llm: LlmProvider,
  messages: ChatMessageRecord[],
  maxSummaryChars: number
): Promise<ConversationCompressionResult> {
  const heuristicSummary = createHeuristicConversationSummary(messages, maxSummaryChars);

  if (!llm.isConfigured()) {
    return heuristicSummary;
  }

  try {
    const summary = await generateTextWithRetry({
      llm,
      messages: [
        {
          role: 'system',
          content: [
            '你是会话压缩助手。',
            '请把较早聊天记录压缩为结构化 JSON，优先保留后续继续协作最重要的主线，而不是平均覆盖所有细节。',
            '先识别讨论类型（周报/复盘、方案讨论、缺陷排查、架构设计、经营分析等），再抽取一级重点。',
            '如果是周报/复盘，优先保留：本周核心结果、核心版本/项目推进、经营观察、风险与下周动作。',
            '不要把一级重点降成无层级功能清单；尽量保留版本号、时间窗口、渠道名、风险判断原词。',
            '若内容里同时有问题判断和后续动作，必须都保留。',
            '额外补充：必须提炼已确认决策、用户偏好/约束、仍未闭环的问题。',
            '只输出 JSON，不要 markdown，不要补充解释，不要编造不存在的信息。',
            'JSON 结构：{"period_or_topic":"", "primary_focuses":[""], "key_deliverables":[""], "risks_and_gaps":[""], "next_actions":[""], "raw_supporting_points":[""], "decision_summary":"", "confirmed_preferences":[""], "open_loops":[""], "summary":""}'
          ].join('')
        },
        {
          role: 'user',
          content: messages.map(message => `${message.role}: ${message.content}`).join('\n')
        }
      ],
      options: { role: 'manager', temperature: 0.1, maxTokens: 600, thinking: false }
    });

    const normalized = summary.trim();
    if (!normalized) {
      return heuristicSummary;
    }

    const parsed = parseStructuredCompressionSummary(normalized, maxSummaryChars);
    if (!parsed) {
      return heuristicSummary;
    }

    return { ...parsed, source: 'llm' };
  } catch {
    return heuristicSummary;
  }
}

function buildCompressionPreviewMessages(messages: ChatMessageRecord[]) {
  return messages
    .filter(message => Boolean(message.content.trim()))
    .slice(-PREVIEW_MESSAGE_COUNT)
    .map(message => ({
      role: message.role,
      content: normalizeMessageSnippet(message.content)
    }));
}
