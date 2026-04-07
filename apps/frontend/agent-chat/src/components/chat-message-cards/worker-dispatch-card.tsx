import { Tag } from 'antd';

import type { ChatMessageRecord } from '@/types/chat';

type WorkerDispatchCardData = Extract<NonNullable<ChatMessageRecord['card']>, { type: 'worker_dispatch' }>;

export function WorkerDispatchCard({ card }: { card: WorkerDispatchCardData }) {
  return (
    <div className="chatx-structured-card">
      <div className="chatx-structured-card__header">
        <Tag color="cyan">Worker Dispatch</Tag>
        {card.currentMinistry ? <Tag>{card.currentMinistry}</Tag> : null}
        {card.chatRoute ? <Tag color="geekblue">{card.chatRoute.flow}</Tag> : null}
      </div>
      <div className="chatx-structured-card__list">
        <article className="chatx-structured-card__item">
          <div className="chatx-structured-card__title">{card.currentWorker ?? '尚未命中具体执行官'}</div>
          <div className="chatx-structured-card__desc">
            {card.routeReason ?? '当前执行路线已由吏部确认，并会继续沿着这条能力链推进。'}
          </div>
          {card.chatRoute ? (
            <div className="chatx-structured-card__meta">
              <Tag>{card.chatRoute.adapter}</Tag>
              <Tag color="blue">priority {card.chatRoute.priority}</Tag>
              <Tag color="purple">{card.chatRoute.reason}</Tag>
            </div>
          ) : null}
        </article>
        {card.usedInstalledSkills.length ? (
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">命中的已安装技能</div>
            <div className="chatx-structured-card__meta">
              {card.usedInstalledSkills.map(item => (
                <Tag key={item} color="blue">
                  {item}
                </Tag>
              ))}
            </div>
          </article>
        ) : null}
        {card.usedCompanyWorkers.length ? (
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">命中的公司专员</div>
            <div className="chatx-structured-card__meta">
              {card.usedCompanyWorkers.map(item => (
                <Tag key={item} color="green">
                  {item}
                </Tag>
              ))}
            </div>
          </article>
        ) : null}
        {card.connectorRefs?.length ? (
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">已命中的 MCP Connector</div>
            <div className="chatx-structured-card__meta">
              {card.connectorRefs.map(item => (
                <Tag key={item} color="cyan">
                  {item}
                </Tag>
              ))}
            </div>
          </article>
        ) : card.mcpRecommendation ? (
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">MCP 诊断</div>
            <div className="chatx-structured-card__desc">{card.mcpRecommendation.summary}</div>
            <div className="chatx-structured-card__desc">{card.mcpRecommendation.reason}</div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
