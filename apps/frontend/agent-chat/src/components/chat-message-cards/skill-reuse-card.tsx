import { Tag } from 'antd';

import type { ChatMessageRecord } from '@/types/chat';

type SkillReuseCardData = Extract<NonNullable<ChatMessageRecord['card']>, { type: 'skill_reuse' }>;

export function SkillReuseCard({ card }: { card: SkillReuseCardData }) {
  return (
    <div className="chatx-structured-card">
      <div className="chatx-structured-card__header">
        <Tag color="purple">Skill Reuse</Tag>
      </div>
      <div className="chatx-structured-card__list">
        {card.reusedSkills.length ? (
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">复用技能</div>
            <div className="chatx-structured-card__meta">
              {card.reusedSkills.map(item => (
                <Tag key={item}>{item}</Tag>
              ))}
            </div>
          </article>
        ) : null}
        {card.usedInstalledSkills.length ? (
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">已安装技能</div>
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
            <div className="chatx-structured-card__title">公司专员</div>
            <div className="chatx-structured-card__meta">
              {card.usedCompanyWorkers.map(item => (
                <Tag key={item} color="green">
                  {item}
                </Tag>
              ))}
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
