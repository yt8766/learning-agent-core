import { Tag } from 'antd';

import type { ChatMessageRecord } from '@/types/chat';

interface LearningSummaryCardProps {
  card: Extract<NonNullable<ChatMessageRecord['card']>, { type: 'learning_summary' }>;
}

export function LearningSummaryCard(props: LearningSummaryCardProps) {
  const { card } = props;

  return (
    <div className="chatx-structured-card">
      <div className="chatx-structured-card__header">
        <Tag color="gold">Learning</Tag>
        <Tag>score {card.score}</Tag>
        <Tag>{card.confidence}</Tag>
      </div>
      <div className="chatx-structured-card__list">
        <article className="chatx-structured-card__item">
          <div className="chatx-structured-card__title">学习建议</div>
          <div className="chatx-structured-card__desc">
            {card.notes.length ? card.notes.join('；') : '当前暂无额外学习说明。'}
          </div>
          <div className="chatx-structured-card__meta">
            <Tag color="purple">推荐 {card.recommendedCount}</Tag>
            <Tag color="green">自动确认 {card.autoConfirmCount}</Tag>
          </div>
        </article>
        {card.candidateReasons?.length ? (
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">沉淀理由</div>
            <div className="chatx-structured-card__desc">{card.candidateReasons.join('；')}</div>
            <div className="chatx-structured-card__meta">
              {(card.expertiseSignals ?? []).map(signal => (
                <Tag key={signal} color="cyan">
                  {signal}
                </Tag>
              ))}
            </div>
          </article>
        ) : null}
        {card.skippedReasons?.length ? (
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">跳过原因</div>
            <div className="chatx-structured-card__desc">{card.skippedReasons.join('；')}</div>
          </article>
        ) : null}
        {card.conflictDetected ? (
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">冲突检测</div>
            <div className="chatx-structured-card__desc">
              检测到长期记忆冲突，需要走保守路径。
              {card.conflictTargets?.length ? ` 相关目标：${card.conflictTargets.join('，')}` : ''}
            </div>
            <div className="chatx-structured-card__meta">
              {(card.derivedFromLayers ?? []).map(layer => (
                <Tag key={layer} color="gold">
                  {layer}
                </Tag>
              ))}
              {card.policyMode ? <Tag color="purple">{card.policyMode}</Tag> : null}
            </div>
          </article>
        ) : null}
        {card.skillGovernanceRecommendations.length ? (
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">技能治理建议</div>
            <div className="chatx-structured-card__meta">
              {card.skillGovernanceRecommendations.map(item => (
                <Tag key={`${item.skillId}:${item.recommendation}`} color="purple">
                  {item.skillId} · {item.recommendation}
                  {typeof item.successRate === 'number' ? ` · ${(item.successRate * 100).toFixed(0)}%` : ''}
                </Tag>
              ))}
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
