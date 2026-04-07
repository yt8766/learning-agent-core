import { Tag } from 'antd';

import type { ChatMessageRecord } from '@/types/chat';

type RuntimeIssueCardData = Extract<NonNullable<ChatMessageRecord['card']>, { type: 'runtime_issue' }>;

export function RuntimeIssueCard({ card }: { card: RuntimeIssueCardData }) {
  return (
    <div className="chatx-structured-card">
      <div className="chatx-structured-card__header">
        <Tag color={card.severity === 'error' ? 'red' : 'orange'}>Runtime Issue</Tag>
        <Tag>{card.title}</Tag>
      </div>
      <div className="chatx-structured-card__list">
        <article className="chatx-structured-card__item">
          <div className="chatx-structured-card__title">模型调用已回退到兜底回复</div>
          <div className="chatx-structured-card__desc">
            {card.notes.length ? card.notes.join('；') : '当前没有更多运行时说明。'}
          </div>
        </article>
      </div>
    </div>
  );
}
