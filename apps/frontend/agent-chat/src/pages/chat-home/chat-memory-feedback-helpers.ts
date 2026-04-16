import type { ChatCheckpointRecord } from '@/types/chat';

type MemoryEvidenceRecord = NonNullable<ChatCheckpointRecord['externalSources']>[number];

export function extractMemoryOverrideSeed(source: MemoryEvidenceRecord) {
  return {
    memoryId: typeof source.detail?.memoryId === 'string' ? source.detail.memoryId : '',
    memoryType: typeof source.detail?.memoryType === 'string' ? source.detail.memoryType : undefined,
    tags: Array.isArray(source.detail?.tags)
      ? source.detail.tags.filter((item): item is string => typeof item === 'string')
      : undefined,
    originalSummary: source.summary.replace(/^已命中历史记忆：/, '').trim()
  };
}

export function buildSessionMemoryOverridePayload(source: MemoryEvidenceRecord, correction: string) {
  const seed = extractMemoryOverrideSeed(source);
  const normalizedCorrection = correction.trim();
  return {
    memoryId: seed.memoryId,
    summary: normalizedCorrection,
    content: normalizedCorrection,
    tags: seed.tags,
    memoryType: seed.memoryType as
      | 'fact'
      | 'preference'
      | 'constraint'
      | 'procedure'
      | 'reflection'
      | 'summary'
      | 'skill-experience'
      | 'failure-pattern'
      | undefined,
    scopeType: 'session' as const,
    reason: `agent-chat explicit correction: ${seed.originalSummary || 'replace previous memory'}`
  };
}

export function buildSessionOnlyMemoryOverridePayload(source: MemoryEvidenceRecord) {
  const seed = extractMemoryOverrideSeed(source);
  return {
    memoryId: seed.memoryId,
    summary: seed.originalSummary,
    content: seed.originalSummary,
    tags: seed.tags,
    memoryType: seed.memoryType as
      | 'fact'
      | 'preference'
      | 'constraint'
      | 'procedure'
      | 'reflection'
      | 'summary'
      | 'skill-experience'
      | 'failure-pattern'
      | undefined,
    scopeType: 'session' as const,
    reason: `agent-chat session-only pin: ${seed.originalSummary || 'reuse for this session only'}`
  };
}

export function buildForgetMemoryOverridePayload(source: MemoryEvidenceRecord) {
  const seed = extractMemoryOverrideSeed(source);
  const summary = `当前会话忽略这条记忆：${seed.originalSummary || 'previous memory'}`;
  return {
    memoryId: seed.memoryId,
    summary,
    content: summary,
    tags: seed.tags,
    memoryType: seed.memoryType as
      | 'fact'
      | 'preference'
      | 'constraint'
      | 'procedure'
      | 'reflection'
      | 'summary'
      | 'skill-experience'
      | 'failure-pattern'
      | undefined,
    scopeType: 'session' as const,
    reason: `agent-chat forget memory for this session: ${seed.originalSummary || 'ignore previous memory'}`
  };
}
