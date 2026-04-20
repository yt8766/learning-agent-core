import type { ChatMessageRecord } from '@agent/core';

const MAX_SUMMARY_CHARS = 1200;

interface CompressionSummaryFields {
  periodOrTopic?: string;
  focuses?: string[];
  keyDeliverables?: string[];
  risks?: string[];
  nextActions?: string[];
  supportingFacts?: string[];
  decisionSummary?: string;
  confirmedPreferences?: string[];
  openLoops?: string[];
}

export interface HeuristicCompressionResult extends CompressionSummaryFields {
  summary: string;
  source: 'heuristic';
}

export function createHeuristicConversationSummary(
  messages: ChatMessageRecord[],
  maxSummaryChars: number
): HeuristicCompressionResult {
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

export function parseStructuredCompressionSummary(
  content: string,
  maxSummaryChars: number
): (CompressionSummaryFields & { summary: string }) | undefined {
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

export function normalizeMessageSnippet(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length > 120 ? `${normalized.slice(0, 120)}...` : normalized;
}

export function formatCompressionSummaryText(
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
  }: CompressionSummaryFields,
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

export function truncateSummary(summary: string, maxSummaryChars = MAX_SUMMARY_CHARS) {
  return summary.length > maxSummaryChars ? `${summary.slice(0, maxSummaryChars)}...` : summary;
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
