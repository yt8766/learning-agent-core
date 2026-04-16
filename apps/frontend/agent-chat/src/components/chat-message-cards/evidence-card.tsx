import { Space, Tag } from 'antd';
import { Sources } from '@ant-design/x';
import { memo } from 'react';

import type { ChatMessageRecord } from '@/types/chat';

type EvidenceDigestSource = Extract<
  NonNullable<ChatMessageRecord['card']>,
  { type: 'evidence_digest' }
>['sources'][number];

interface EvidenceCardProps {
  card: Extract<NonNullable<ChatMessageRecord['card']>, { type: 'evidence_digest' }>;
}

export function EvidenceCard(props: EvidenceCardProps) {
  const groupedSources = groupEvidenceSources(props.card.sources);
  return (
    <div className="chatx-structured-card">
      <div className="chatx-structured-card__header">
        <Tag color="blue">Sources</Tag>
        <Tag>{props.card.sources.length} 条来源</Tag>
      </div>
      <div className="chatx-sources-groups__title">来源引用</div>
      <div className="chatx-sources-groups">
        {groupedSources.map(group => (
          <div key={group.key} className="chatx-sources-group">
            <div className="chatx-sources-group__title">{group.title}</div>
            <Sources
              title={group.title}
              className="chatx-sources"
              classNames={{
                title: 'chatx-sources__title-wrap',
                content: 'chatx-sources__content'
              }}
              styles={{
                root: {
                  width: '100%'
                }
              }}
              items={group.sources.map(source => ({
                key: source.id,
                title: source.summary,
                description: <SourceDescription source={source} />
              }))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function hasInlineSourceReferences(content: string) {
  return /<sup>\s*\d+\s*<\/sup>/i.test(content);
}

export function createInlineSourceSupComponent(sources: EvidenceDigestSource[]) {
  const items = sources.slice(0, 12).map((source, index) => ({
    key: index + 1,
    title: `${index + 1}. ${source.summary}`,
    url: source.sourceUrl,
    description: <SourceDescription source={source} />
  }));

  return memo(function InlineSourceSup(props: { children?: unknown }) {
    const activeKey = Number.parseInt(String(props.children ?? '0'), 10);
    if (!Number.isFinite(activeKey) || activeKey <= 0 || activeKey > items.length) {
      return <sup>{props.children as string}</sup>;
    }

    return <Sources inline items={items} activeKey={activeKey} title={String(props.children ?? activeKey)} />;
  });
}

function SourceDescription(props: { source: EvidenceDigestSource }) {
  const source = props.source;
  const entities = extractSourceEntities(source).slice(0, 2);
  return (
    <Space size={6} wrap className="chatx-sources__meta">
      <Tag>{getSourceTypeLabel(source.sourceType)}</Tag>
      <Tag color="blue">{source.trustClass}</Tag>
      {typeof source.detail?.scopeType === 'string' ? <Tag>scope {source.detail.scopeType}</Tag> : null}
      {entities.map(entity => (
        <Tag key={`${source.id}:${entity}`}>{entity}</Tag>
      ))}
      {typeof source.detail?.score === 'number' ? (
        <Tag color="geekblue">score {source.detail.score.toFixed(2)}</Tag>
      ) : null}
      <span className="chatx-sources__desc">
        {source.sourceUrl ??
          (typeof source.detail?.documentId === 'string' ? source.detail.documentId : undefined) ??
          'document-reference'}
      </span>
      {typeof source.detail?.reason === 'string' && source.detail.reason ? (
        <span className="chatx-sources__desc">采用原因：{source.detail.reason}</span>
      ) : null}
    </Space>
  );
}

function groupEvidenceSources(sources: EvidenceDigestSource[]) {
  const groups = new Map<string, { key: string; title: string; sources: EvidenceDigestSource[] }>();
  for (const source of sources) {
    const key = getSourceGroupKey(source);
    const title = getSourceGroupTitle(key);
    const current = groups.get(key) ?? { key, title, sources: [] };
    current.sources.push(source);
    groups.set(key, current);
  }

  return Array.from(groups.values());
}

function getSourceGroupKey(source: EvidenceDigestSource) {
  if (source.sourceType === 'memory_reuse' || source.sourceType === 'rule_reuse') {
    return 'memory';
  }
  if (source.sourceType === 'document') {
    return 'documents';
  }
  if (source.sourceUrl) {
    return 'web';
  }
  return 'other';
}

function getSourceGroupTitle(key: string) {
  switch (key) {
    case 'memory':
      return '记忆 / 规则复用';
    case 'documents':
      return '文档引用';
    case 'web':
      return '网页引用';
    default:
      return '其他引用';
  }
}

function getSourceTypeLabel(sourceType: string) {
  switch (sourceType) {
    case 'memory_reuse':
      return 'memory';
    case 'rule_reuse':
      return 'rule';
    case 'web_research_plan':
      return 'web';
    case 'document':
      return 'document';
    case 'research':
      return 'research';
    default:
      return sourceType;
  }
}

function extractSourceEntities(source: EvidenceDigestSource) {
  const relatedEntities = source.detail?.relatedEntities;
  if (!Array.isArray(relatedEntities)) {
    return [];
  }
  return relatedEntities
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
      return entityType && entityId ? `${entityType}:${entityId}` : entityType || entityId;
    })
    .filter(Boolean);
}
