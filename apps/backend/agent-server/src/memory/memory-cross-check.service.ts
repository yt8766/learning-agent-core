import { Injectable } from '@nestjs/common';
import type { EvidenceRecord, MemoryRecord, MemoryScrubberFinding } from '@agent/memory';

type CrossCheckFinding = MemoryScrubberFinding & {
  evidenceRecords?: EvidenceRecord[];
};

interface OfficialRulePattern {
  id: string;
  title: string;
  category: NonNullable<MemoryRecord['quarantineCategory']>;
  blockedTerms: string[];
  suggestion: string;
}

const OFFICIAL_RULE_PATTERNS: OfficialRulePattern[] = [
  {
    id: 'official-docs-no-demo-urls',
    title: '官方资料优先要求避免演示站点当作正式规则',
    category: 'conflicts_with_official_docs',
    blockedTerms: ['example.com', 'demo site', '演示网址'],
    suggestion: '请改为引用正式文档或真实业务规则后再恢复。'
  },
  {
    id: 'official-rulebook-no-stale-latest-claims',
    title: '最新事实必须带明确来源或时间锚点',
    category: 'stale_fact',
    blockedTerms: ['最新规定', 'today', '最新版本', '刚刚更新'],
    suggestion: '请补充绝对日期和可信来源，再考虑恢复。'
  }
];

@Injectable()
export class MemoryCrossCheckService {
  async validate(record: MemoryRecord): Promise<CrossCheckFinding | null> {
    const haystack = `${record.summary}\n${record.content}\n${record.tags.join(' ')}`.toLowerCase();

    const unsupportedClaim = this.detectUnsupportedClaim(record, haystack);
    if (unsupportedClaim) {
      return unsupportedClaim;
    }

    const conflictingPattern = OFFICIAL_RULE_PATTERNS.find(pattern =>
      pattern.blockedTerms.some(term => haystack.includes(term.toLowerCase()))
    );
    if (!conflictingPattern) {
      return null;
    }

    return {
      memoryId: record.id,
      shouldQuarantine: true,
      reason: conflictingPattern.title,
      category: conflictingPattern.category,
      detail: `Matched official cross-check pattern "${conflictingPattern.id}".`,
      restoreSuggestion: conflictingPattern.suggestion,
      evidenceRefs: [`official-rule:${conflictingPattern.id}`],
      evidenceRecords: [
        this.buildEvidenceRecord(record, {
          id: `official-rule:${conflictingPattern.id}`,
          summary: conflictingPattern.title,
          detail: `Blocked terms: ${conflictingPattern.blockedTerms.join(', ')}`
        })
      ]
    };
  }

  private detectUnsupportedClaim(record: MemoryRecord, haystack: string): CrossCheckFinding | null {
    const hasStrongClaim =
      /必须|一定|唯一|100%|绝对|never|always/.test(record.summary) ||
      /必须|一定|唯一|100%|绝对|never|always/.test(record.content);
    const hasSourceTag = record.tags.some(tag =>
      ['official', 'source', 'citation', 'evidence'].includes(tag.toLowerCase())
    );
    const hasEvidenceLikeText = /http|文档|docs|source|依据|引用/.test(haystack);

    if (!hasStrongClaim || hasSourceTag || hasEvidenceLikeText) {
      return null;
    }

    return {
      memoryId: record.id,
      shouldQuarantine: true,
      reason: 'Memory contains strong claim without official backing.',
      category: 'unsupported_claim',
      detail: 'Detected strong normative statement without source markers.',
      restoreSuggestion: '请补充来源引用或降级为启发式经验后再恢复。',
      evidenceRefs: ['official-rule:unsupported-claim-check'],
      evidenceRecords: [
        this.buildEvidenceRecord(record, {
          id: 'official-rule:unsupported-claim-check',
          summary: 'Unsupported claim cross-check',
          detail: 'Strong claim without source markers'
        })
      ]
    };
  }

  private buildEvidenceRecord(
    record: MemoryRecord,
    input: {
      id: string;
      summary: string;
      detail: string;
    }
  ): EvidenceRecord {
    return {
      id: input.id,
      taskId: record.taskId ?? `memory:${record.id}`,
      sourceId: input.id,
      sourceType: 'official_rule',
      trustClass: 'official',
      summary: input.summary,
      detail: {
        memoryId: record.id,
        rationale: input.detail
      },
      linkedRunId: record.taskId,
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString()
    };
  }
}
