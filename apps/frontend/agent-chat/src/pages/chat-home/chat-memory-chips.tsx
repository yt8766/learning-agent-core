import { Space, Tag, Typography } from 'antd';

import type { ChatCheckpointRecord } from '@/types/chat';

const { Text } = Typography;

type MemoryEvidenceRecord = NonNullable<ChatCheckpointRecord['externalSources']>[number];

interface ChatMemoryChipsProps {
  sources: MemoryEvidenceRecord[];
  reusedMemories?: string[];
  reusedRules?: string[];
  reusedSkills?: string[];
}

export function ChatMemoryChips(props: ChatMemoryChipsProps) {
  const visibleSources = props.sources.slice(0, 4);
  if (
    !visibleSources.length &&
    !(props.reusedMemories?.length || props.reusedRules?.length || props.reusedSkills?.length)
  ) {
    return null;
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Space size={[6, 6]} wrap>
        {visibleSources.map(source => (
          <Tag key={source.id} color={getSourceColor(source)}>
            {getSourceChipLabel(source)}
          </Tag>
        ))}
        {(props.reusedSkills ?? []).slice(0, 2).map(skillId => (
          <Tag key={skillId} color="cyan">
            skill:{skillId}
          </Tag>
        ))}
      </Space>
      {visibleSources.map(source => {
        const reason = typeof source.detail?.reason === 'string' ? source.detail.reason : '';
        const score = typeof source.detail?.score === 'number' ? source.detail.score.toFixed(2) : '';
        const scopeType = typeof source.detail?.scopeType === 'string' ? source.detail.scopeType : '';
        const relatedEntities = extractEntityLabels(source).slice(0, 2);
        if (!reason && !score && !scopeType && !relatedEntities.length) {
          return null;
        }

        return (
          <Text key={`${source.id}:reason`} type="secondary" style={{ fontSize: 12 }}>
            Why this memory was used: {reason || 'matched structured memory context'}
            {score ? ` · score ${score}` : ''}
            {scopeType ? ` · scope ${scopeType}` : ''}
            {relatedEntities.length ? ` · ${relatedEntities.join(' / ')}` : ''}
          </Text>
        );
      })}
    </div>
  );
}

function getSourceChipLabel(source: MemoryEvidenceRecord) {
  if (source.sourceType === 'rule_reuse') {
    return `rule:${source.summary.replace(/^已命中历史规则：/, '').slice(0, 18)}`;
  }
  if (typeof source.detail?.reflectionId === 'string') {
    return `reflection:${source.summary.replace(/^已命中历史反思：/, '').slice(0, 18)}`;
  }
  return `memory:${source.summary.replace(/^已命中历史记忆：/, '').slice(0, 18)}`;
}

function getSourceColor(source: MemoryEvidenceRecord) {
  if (source.sourceType === 'rule_reuse') {
    return 'purple';
  }
  if (typeof source.detail?.reflectionId === 'string') {
    return 'geekblue';
  }
  return 'gold';
}

function extractEntityLabels(source: MemoryEvidenceRecord) {
  if (!Array.isArray(source.detail?.relatedEntities)) {
    return [];
  }
  return source.detail.relatedEntities
    .map(item => {
      if (!item || typeof item !== 'object') {
        return '';
      }
      const entityType =
        typeof (item as { entityType?: unknown }).entityType === 'string'
          ? (item as { entityType: string }).entityType
          : '';
      const entityId =
        typeof (item as { entityId?: unknown }).entityId === 'string' ? (item as { entityId: string }).entityId : '';
      return entityType && entityId ? `${entityType}:${entityId}` : '';
    })
    .filter(Boolean);
}
