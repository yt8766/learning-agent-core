import type { ChatCheckpointRecord } from '@/types/chat';

export interface SpecialistFindingViewModel {
  specialistId: string;
  domain: string;
  contractVersion: string;
  source: string;
  stage: string;
  summary: string;
  riskLevel?: string;
  blockingIssues: string[];
  constraints: string[];
  suggestions: string[];
  evidenceRefs: string[];
  confidence?: number;
  degraded?: boolean;
  fallbackMessage?: string;
}

export function normalizeSpecialistFinding(
  finding: NonNullable<ChatCheckpointRecord['specialistFindings']>[number]
): SpecialistFindingViewModel {
  const parsed = parseBestEffortFindingSummary(finding.summary);
  if (parsed === null) {
    return {
      specialistId: finding.specialistId,
      domain: finding.domain,
      contractVersion: finding.contractVersion,
      source: finding.source,
      stage: finding.stage,
      summary: finding.summary,
      riskLevel: finding.riskLevel,
      blockingIssues: finding.blockingIssues ?? [],
      constraints: finding.constraints ?? [],
      suggestions: finding.suggestions ?? [],
      evidenceRefs: finding.evidenceRefs ?? [],
      confidence: finding.confidence
    };
  }

  if (parsed.ok) {
    const payload = parsed.value;
    const degraded = parsed.repaired;
    return {
      specialistId: finding.specialistId,
      domain: finding.domain,
      contractVersion: finding.contractVersion,
      source: finding.source,
      stage: finding.stage,
      summary: typeof payload.summary === 'string' ? payload.summary : finding.summary,
      riskLevel: typeof payload.riskLevel === 'string' ? payload.riskLevel : finding.riskLevel,
      blockingIssues: toStringArray(payload.blockingIssues, finding.blockingIssues),
      constraints: toStringArray(payload.constraints, finding.constraints),
      suggestions: toStringArray(payload.suggestions, finding.suggestions),
      evidenceRefs: toStringArray(payload.evidenceRefs, finding.evidenceRefs),
      confidence: typeof payload.confidence === 'number' ? payload.confidence : finding.confidence,
      degraded,
      fallbackMessage: degraded ? '专家详细报告因格式异常已做兼容修复，核心结论已纳入主导专家判断。' : undefined
    };
  }

  return {
    specialistId: finding.specialistId,
    domain: finding.domain,
    contractVersion: finding.contractVersion,
    source: finding.source,
    stage: finding.stage,
    summary: finding.summary,
    riskLevel: finding.riskLevel,
    blockingIssues: finding.blockingIssues ?? [],
    constraints: finding.constraints ?? [],
    suggestions: finding.suggestions ?? [],
    evidenceRefs: finding.evidenceRefs ?? [],
    confidence: finding.confidence,
    degraded: true,
    fallbackMessage: '专家详细报告因格式异常未完整渲染，但核心结论已纳入主导专家判断。'
  };
}

function parseBestEffortFindingSummary(raw: string) {
  const text = raw.trim();
  if (!text.startsWith('{') && !text.startsWith('[')) {
    return null;
  }

  const attempts = [text, repairPartialJson(text)];
  for (const [index, candidate] of attempts.entries()) {
    try {
      return { ok: true as const, repaired: index > 0, value: JSON.parse(candidate) as Record<string, unknown> };
    } catch {
      continue;
    }
  }

  return { ok: false as const };
}

function repairPartialJson(input: string) {
  const normalized = input.replace(/,\s*([}\]])/g, '$1');
  const openCurlies = (normalized.match(/{/g) ?? []).length;
  const closeCurlies = (normalized.match(/}/g) ?? []).length;
  const openBrackets = (normalized.match(/\[/g) ?? []).length;
  const closeBrackets = (normalized.match(/]/g) ?? []).length;
  return `${normalized}${']'.repeat(Math.max(0, openBrackets - closeBrackets))}${'}'.repeat(Math.max(0, openCurlies - closeCurlies))}`;
}

function toStringArray(primary: unknown, fallback?: string[]) {
  if (Array.isArray(primary)) {
    return primary.filter((item): item is string => typeof item === 'string');
  }
  return fallback ?? [];
}
