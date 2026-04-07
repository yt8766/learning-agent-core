import type { ChatMessageRecord, ChatSessionRecord } from '@agent/shared';
import type { ContextStrategy } from '@agent/config';

import type { LlmProvider } from '../adapters/llm/llm-provider';

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
    const summary = await llm.generateText(
      [
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
      { role: 'manager', temperature: 0.1, maxTokens: 600, thinking: false }
    );

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

function createHeuristicConversationSummary(
  messages: ChatMessageRecord[],
  maxSummaryChars: number
): ConversationCompressionResult {
  const nonEmptyLines = messages
    .flatMap(message =>
      message.content
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
    )
    .filter(line => !/^#{1,6}\s*/.test(line));
  const periodOrTopic = detectPeriodOrTopic(nonEmptyLines);
  const primaryFocuses = dedupeStrings(nonEmptyLines.filter(line => /^\d+\.\s*/.test(line)).map(stripListMarker), 5);
  const keyDeliverables = dedupeStrings(
    nonEmptyLines
      .filter(line => /交付|发布|对接完成|上线|版本|渠道|包网|代理包|独立开播包/i.test(line))
      .map(stripListMarker),
    5
  );
  const risks = dedupeStrings(
    nonEmptyLines
      .filter(line => /风险|问题|未承接|没有很好承接|不足|亏损|补贴|gap|缺口/i.test(line))
      .map(stripListMarker),
    4
  );
  const nextActions = dedupeStrings(
    nonEmptyLines.filter(line => /修复|优化|推进|继续|跟进|强化|宣发|验证|排查|改造/i.test(line)).map(stripListMarker),
    4
  );
  const decisionSummary = dedupeStrings(
    nonEmptyLines.filter(line => /确认|决定|采用|改成|收敛到|统一为|必须|默认/i.test(line)).map(stripListMarker),
    4
  ).join('；');
  const confirmedPreferences = dedupeStrings(
    nonEmptyLines.filter(line => /希望|倾向|优先|偏好|约束|限制|必须使用|不要/i.test(line)).map(stripListMarker),
    4
  );
  const openLoops = dedupeStrings(
    nonEmptyLines.filter(line => /待定|待确认|未完成|后续|下一步|仍需|还要|TODO|todo/i.test(line)).map(stripListMarker),
    4
  );
  const supportingFacts = dedupeStrings(
    nonEmptyLines
      .filter(
        line =>
          !primaryFocuses.includes(stripListMarker(line)) &&
          !keyDeliverables.includes(stripListMarker(line)) &&
          !risks.includes(stripListMarker(line)) &&
          !nextActions.includes(stripListMarker(line))
      )
      .map(stripListMarker),
    4
  );
  const fallbackFocuses =
    primaryFocuses.length > 0
      ? primaryFocuses
      : dedupeStrings(
          messages
            .filter(message => message.role === 'user')
            .slice(-4)
            .map(message => normalizeMessageSnippet(message.content)),
          4
        );
  const fallbackSupportingFacts =
    supportingFacts.length > 0
      ? supportingFacts
      : dedupeStrings(
          messages
            .filter(message => message.role !== 'user')
            .slice(-4)
            .map(message => normalizeMessageSnippet(message.content)),
          4
        );

  return {
    periodOrTopic,
    focuses: fallbackFocuses,
    keyDeliverables,
    risks,
    nextActions,
    decisionSummary,
    confirmedPreferences,
    openLoops,
    supportingFacts: fallbackSupportingFacts,
    summary: formatCompressionSummaryText(
      {
        periodOrTopic,
        focuses: fallbackFocuses,
        keyDeliverables,
        risks,
        nextActions,
        decisionSummary,
        confirmedPreferences,
        openLoops,
        supportingFacts: fallbackSupportingFacts
      },
      maxSummaryChars
    ),
    source: 'heuristic'
  };
}

function normalizeMessageSnippet(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length > 120 ? `${normalized.slice(0, 120)}...` : normalized;
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

function parseStructuredCompressionSummary(
  content: string,
  maxSummaryChars: number
): Omit<ConversationCompressionResult, 'source'> | undefined {
  const normalizedJson = extractJsonObject(content);
  if (!normalizedJson) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(normalizedJson) as Record<string, unknown>;
    const periodOrTopic = typeof parsed.period_or_topic === 'string' ? parsed.period_or_topic.trim() : undefined;
    const focuses = sanitizeStringArray(parsed.primary_focuses, 5);
    const keyDeliverables = sanitizeStringArray(parsed.key_deliverables, 5);
    const risks = sanitizeStringArray(parsed.risks_and_gaps, 4);
    const nextActions = sanitizeStringArray(parsed.next_actions, 4);
    const supportingFacts = sanitizeStringArray(parsed.raw_supporting_points, 4);
    const decisionSummary = typeof parsed.decision_summary === 'string' ? parsed.decision_summary.trim() : undefined;
    const confirmedPreferences = sanitizeStringArray(parsed.confirmed_preferences, 4);
    const openLoops = sanitizeStringArray(parsed.open_loops, 4);
    const providedSummary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    const summary = truncateSummary(
      providedSummary ||
        formatCompressionSummaryText(
          {
            periodOrTopic,
            focuses,
            keyDeliverables,
            risks,
            nextActions,
            decisionSummary,
            confirmedPreferences,
            openLoops,
            supportingFacts
          },
          maxSummaryChars
        ),
      maxSummaryChars
    );

    if (!summary) {
      return undefined;
    }

    return {
      summary,
      periodOrTopic: periodOrTopic || undefined,
      focuses,
      keyDeliverables,
      risks,
      nextActions,
      decisionSummary,
      confirmedPreferences,
      openLoops,
      supportingFacts
    };
  } catch {
    return undefined;
  }
}

function extractJsonObject(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced ?? content).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return undefined;
  }
  return candidate.slice(start, end + 1);
}

function sanitizeStringArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const sanitized = value
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);

  return sanitized.length ? sanitized : undefined;
}

function stripListMarker(line: string) {
  return line
    .replace(/^[-*•]\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .trim();
}

function dedupeStrings(items: string[], maxItems: number) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const normalized = normalizeMessageSnippet(item)
      .replace(/[；;。]+$/g, '')
      .trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= maxItems) {
      break;
    }
  }

  return result;
}

function detectPeriodOrTopic(lines: string[]) {
  const joined = lines.join(' ');
  const periodMatch = joined.match(/\b\d{1,2}\/\d{1,2}\s*-\s*\d{1,2}\/\d{1,2}\b/);
  if (periodMatch) {
    return periodMatch[0];
  }

  const titleLine = lines.find(line => /周报|复盘|架构|经营|版本|计划/.test(line));
  return titleLine ? normalizeMessageSnippet(titleLine) : undefined;
}

function formatCompressionSummaryText(
  {
    periodOrTopic,
    focuses,
    keyDeliverables,
    risks,
    nextActions,
    decisionSummary,
    confirmedPreferences,
    openLoops,
    supportingFacts
  }: Partial<Omit<ConversationCompressionResult, 'summary' | 'source'>>,
  maxSummaryChars: number
) {
  const sections = [
    periodOrTopic ? `主题：${periodOrTopic}` : '',
    focuses?.length ? `一级重点：${focuses.join('；')}` : '',
    decisionSummary ? `已确认决策：${decisionSummary}` : '',
    confirmedPreferences?.length ? `用户偏好 / 约束：${confirmedPreferences.join('；')}` : '',
    keyDeliverables?.length ? `关键交付：${keyDeliverables.join('；')}` : '',
    risks?.length ? `风险与缺口：${risks.join('；')}` : '',
    nextActions?.length ? `后续动作：${nextActions.join('；')}` : '',
    openLoops?.length ? `未完成事项：${openLoops.join('；')}` : '',
    supportingFacts?.length ? `补充事实：${supportingFacts.join('；')}` : ''
  ].filter(Boolean);

  return truncateSummary(sections.join('\n'), maxSummaryChars);
}

function truncateSummary(summary: string, maxSummaryChars = MAX_SUMMARY_CHARS) {
  return summary.length > maxSummaryChars ? `${summary.slice(0, maxSummaryChars)}...` : summary;
}
