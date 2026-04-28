import type { EvidenceRecord } from '@agent/memory';

/**
 * 合并两组 EvidenceRecord，按 sourceType:sourceUrl|summary 去重。
 * 纯工具函数，不依赖任何运行时状态。
 */
export function mergeEvidence(existing: EvidenceRecord[], incoming: EvidenceRecord[]): EvidenceRecord[] {
  const merged = [...existing];
  for (const item of incoming) {
    const key = `${item.sourceType}:${item.sourceUrl ?? item.summary}`;
    if (!merged.some(candidate => `${candidate.sourceType}:${candidate.sourceUrl ?? candidate.summary}` === key)) {
      merged.push(item);
    }
  }
  return merged;
}

/**
 * 根据 URL hostname 推断 EvidenceRecord 的可信级别。
 */
export function inferTrustClass(sourceUrl: string): EvidenceRecord['trustClass'] {
  try {
    const host = new URL(sourceUrl).hostname.toLowerCase();
    if (
      host.includes('openai.com') ||
      host.includes('anthropic.com') ||
      host.includes('deepseek.com') ||
      host.includes('openclaw.ai') ||
      host.includes('open-claw.org') ||
      host.includes('npmjs.com') ||
      host.includes('developer.mozilla.org')
    ) {
      return 'official';
    }
    if (host.includes('github.com')) {
      return 'curated';
    }
    return 'community';
  } catch {
    return 'unverified';
  }
}

/**
 * 规范化 installed skill worker ID：去除 "installed-skill:" 前缀。
 */
export function normalizeInstalledSkillId(workerId: string): string {
  return workerId.startsWith('installed-skill:') ? workerId.replace('installed-skill:', '') : workerId;
}
