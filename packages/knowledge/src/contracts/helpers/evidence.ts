import type { KnowledgeEvidenceRecord } from './evidence-utils';

export function isCitationEvidenceSource(
  source: Pick<KnowledgeEvidenceRecord, 'sourceType' | 'sourceUrl' | 'trustClass'>
) {
  if (
    source.sourceType === 'freshness_meta' ||
    source.sourceType === 'web_search_result' ||
    source.sourceType === 'web_research_plan'
  ) {
    return false;
  }

  if (source.sourceUrl) {
    return true;
  }

  return source.sourceType === 'document' || source.sourceType === 'web';
}
