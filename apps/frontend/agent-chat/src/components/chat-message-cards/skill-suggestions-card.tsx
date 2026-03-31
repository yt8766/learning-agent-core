import { Button, Space, Tag } from 'antd';

import type { ChatMessageRecord } from '@/types/chat';
import {
  getAvailabilityTagColor,
  getSafetyVerdictColor,
  getSkillInstallStatusDescription,
  getSkillInstallStatusMeta
} from './skill-suggestions-meta';

interface SkillSuggestionsCardProps {
  card: Extract<NonNullable<ChatMessageRecord['card']>, { type: 'skill_suggestions' }>;
  onSkillInstall?: (
    suggestion: Extract<NonNullable<ChatMessageRecord['card']>, { type: 'skill_suggestions' }>['suggestions'][number]
  ) => void;
}

export function SkillSuggestionsCard(props: SkillSuggestionsCardProps) {
  const { card, onSkillInstall } = props;
  const activeInstallSuggestion = card.suggestions.find(item => item.installState);
  const triggerReasonLabel =
    card.triggerReason === 'user_requested'
      ? '用户主动找 Skill'
      : card.triggerReason === 'domain_specialization_needed'
        ? '需要更专业能力'
        : card.triggerReason === 'capability_gap_detected'
          ? '检测到能力缺口'
          : undefined;

  return (
    <div className="chatx-structured-card">
      <div className="chatx-structured-card__header">
        <Tag color={card.capabilityGapDetected ? 'orange' : 'blue'}>
          {card.capabilityGapDetected ? 'Capability Gap' : 'Local Skills'}
        </Tag>
        <Tag>{card.status}</Tag>
        <Tag>{card.suggestions.length} 个候选</Tag>
        {triggerReasonLabel ? <Tag color="magenta">{triggerReasonLabel}</Tag> : null}
        {card.remoteSearch ? <Tag color="cyan">{card.remoteSearch.discoverySource}</Tag> : null}
      </div>
      <div className="chatx-structured-card__list">
        {activeInstallSuggestion?.installState ? (
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">当前轮 Skill 介入</div>
            <div className="chatx-structured-card__desc">
              {activeInstallSuggestion.displayName} ·{' '}
              {getSkillInstallStatusMeta(activeInstallSuggestion.installState)?.label}
            </div>
            {getSkillInstallStatusDescription(activeInstallSuggestion.installState) ? (
              <div className="chatx-structured-card__desc">
                {getSkillInstallStatusDescription(activeInstallSuggestion.installState)}
              </div>
            ) : null}
          </article>
        ) : null}
        {card.mcpRecommendation ? (
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">MCP / Skill 建议</div>
            <div className="chatx-structured-card__desc">{card.mcpRecommendation.summary}</div>
            <div className="chatx-structured-card__desc">{card.mcpRecommendation.reason}</div>
          </article>
        ) : null}
        {card.remoteSearch ? (
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">远程检索</div>
            <div className="chatx-structured-card__desc">
              已通过 {card.remoteSearch.discoverySource} 检索 “{card.remoteSearch.query}”，返回{' '}
              {card.remoteSearch.resultCount} 个远程候选。
            </div>
          </article>
        ) : null}
        {card.safetyNotes.length ? (
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">安全评估</div>
            <div className="chatx-structured-card__desc">{card.safetyNotes.join('；')}</div>
          </article>
        ) : null}
        {card.suggestions.map(item => (
          <article key={`${item.kind}:${item.id}`} className="chatx-structured-card__item">
            <div className="chatx-structured-card__meta">
              <Tag>{item.kind}</Tag>
              <Tag color={getAvailabilityTagColor(item.availability)}>{item.availability}</Tag>
              {item.safety ? <Tag color={getSafetyVerdictColor(item.safety.verdict)}>{item.safety.verdict}</Tag> : null}
              {item.safety ? <Tag color="gold">trust {item.safety.trustScore}</Tag> : null}
              {item.version ? <Tag>{item.version}</Tag> : null}
              {item.sourceLabel ? <Tag color="cyan">{item.sourceLabel}</Tag> : null}
              {typeof item.successRate === 'number' ? (
                <Tag color="green">success {(item.successRate * 100).toFixed(0)}%</Tag>
              ) : null}
              {item.governanceRecommendation ? <Tag color="gold">{item.governanceRecommendation}</Tag> : null}
              {item.installState ? (
                <Tag color={getSkillInstallStatusMeta(item.installState)?.color}>
                  {getSkillInstallStatusMeta(item.installState)?.label}
                </Tag>
              ) : null}
            </div>
            <div className="chatx-structured-card__title">{item.displayName}</div>
            <div className="chatx-structured-card__desc">{item.summary}</div>
            <div className="chatx-structured-card__desc">{item.reason}</div>
            {item.repo ? <div className="chatx-structured-card__desc">Repo: {item.repo}</div> : null}
            {item.detailsUrl ? (
              <div className="chatx-structured-card__desc">
                <a href={item.detailsUrl} target="_blank" rel="noreferrer">
                  查看 skills.sh 详情
                </a>
              </div>
            ) : null}
            {item.installCommand ? <div className="chatx-structured-card__desc">{item.installCommand}</div> : null}
            {item.safety?.reasons.length ? (
              <div className="chatx-structured-card__desc">{item.safety.reasons.join('；')}</div>
            ) : null}
            {item.installState?.result ? (
              <div className="chatx-structured-card__desc">状态：{item.installState.result}</div>
            ) : null}
            {item.installState?.failureCode ? (
              <div className="chatx-structured-card__desc">失败原因：{item.installState.failureCode}</div>
            ) : null}
            {item.installState?.receiptId ? (
              <div className="chatx-structured-card__desc">安装单号：{item.installState.receiptId}</div>
            ) : null}
            <div className="chatx-structured-card__meta">
              {item.requiredCapabilities.map(capability => (
                <Tag key={capability} color="purple">
                  {capability}
                </Tag>
              ))}
              {(item.requiredConnectors ?? []).map(connector => (
                <Tag key={connector} color="cyan">
                  {connector}
                </Tag>
              ))}
            </div>
            {item.availability === 'installable-remote' || item.availability === 'installable-local' ? (
              <Space wrap>
                <Button
                  size="small"
                  type={item.installState?.status === 'installed' ? 'default' : 'primary'}
                  disabled={
                    item.installState?.status === 'requesting' ||
                    item.installState?.status === 'pending' ||
                    item.installState?.status === 'approved' ||
                    item.installState?.status === 'installing' ||
                    item.installState?.status === 'installed'
                  }
                  onClick={() => onSkillInstall?.(item)}
                >
                  {item.installState?.status === 'pending'
                    ? '等待审批'
                    : item.installState?.status === 'approved' || item.installState?.status === 'installing'
                      ? '安装中'
                      : item.installState?.status === 'installed'
                        ? '已安装'
                        : item.installState?.status === 'failed'
                          ? '重新安装'
                          : item.installState?.status === 'rejected'
                            ? '重新申请'
                            : '安装 Skill'}
                </Button>
              </Space>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
