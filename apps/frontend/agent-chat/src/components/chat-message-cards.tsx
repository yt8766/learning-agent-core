import { Tag } from 'antd';
import { XMarkdown } from '@ant-design/x-markdown';

import type { ChatMessageRecord } from '@/types/chat';
import { ApprovalRequestCard } from './chat-message-cards/approval-request-card';
import { getCapabilityCatalogTagColor, type PlanQuestionCardData } from './chat-message-cards/card-meta';
import {
  createInlineSourceSupComponent,
  EvidenceCard,
  hasInlineSourceReferences
} from './chat-message-cards/evidence-card';
import { LearningSummaryCard } from './chat-message-cards/learning-summary-card';
import { PlanQuestionCard } from './chat-message-cards/plan-question-card';
import { RuntimeIssueCard } from './chat-message-cards/runtime-issue-card';
import { SkillSuggestionsCard } from './chat-message-cards/skill-suggestions-card';
import { SkillReuseCard } from './chat-message-cards/skill-reuse-card';
import { WorkerDispatchCard } from './chat-message-cards/worker-dispatch-card';

type EvidenceDigestSource = Extract<
  NonNullable<ChatMessageRecord['card']>,
  { type: 'evidence_digest' }
>['sources'][number];

export function CopyGlyph({ copied }: { copied: boolean }) {
  if (copied) {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M6.4 11.4L3.6 8.6l1-1 1.8 1.8 5-5 1 1-6 6Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M5 2.5A1.5 1.5 0 0 1 6.5 1h5A1.5 1.5 0 0 1 13 2.5v7A1.5 1.5 0 0 1 11.5 11h-5A1.5 1.5 0 0 1 5 9.5v-7Zm1.5-.5a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5h-5Z"
        fill="currentColor"
      />
      <path
        d="M3.5 5A1.5 1.5 0 0 0 2 6.5v6A1.5 1.5 0 0 0 3.5 14h5A1.5 1.5 0 0 0 10 12.5V12H9v.5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-6a.5.5 0 0 1 .5-.5H4V5h-.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function renderStructuredMessageCard(
  message: ChatMessageRecord,
  streaming: boolean,
  options: {
    onApprovalAction?: (intent: string, approved: boolean) => void;
    onApprovalAllowAlways?: (intent: string, serverId?: string, capabilityId?: string) => void;
    onApprovalFeedback?: (intent: string, reason?: string) => void;
    onPlanAction?: (params: {
      action: 'input' | 'bypass' | 'abort';
      interruptId?: string;
      answers?: Array<{
        questionId: string;
        optionId?: string;
        freeform?: string;
      }>;
    }) => void;
    onSkillInstall?: (
      suggestion: Extract<NonNullable<ChatMessageRecord['card']>, { type: 'skill_suggestions' }>['suggestions'][number]
    ) => void;
    inlineEvidenceSources?: EvidenceDigestSource[];
  }
) {
  if (message.card?.type === 'plan_question') {
    return <PlanQuestionCard card={message.card as PlanQuestionCardData} onAction={options.onPlanAction} />;
  }

  if (message.card?.type === 'approval_request') {
    return (
      <ApprovalRequestCard
        card={message.card}
        content={message.content}
        onApprovalAction={options.onApprovalAction}
        onApprovalFeedback={options.onApprovalFeedback}
      />
    );
  }

  if (message.card?.type === 'control_notice') {
    return (
      <div className={`chatx-control-notice is-${message.card.tone ?? 'neutral'}`}>
        <div className="chatx-control-notice__label">{message.card.label ?? '状态更新'}</div>
        <div className="chatx-control-notice__content">{message.content}</div>
      </div>
    );
  }

  if (message.card?.type === 'compression_summary') {
    const label =
      typeof message.card.condensedMessageCount === 'number'
        ? `正在自动压缩背景信息（已折叠 ${message.card.condensedMessageCount} 条消息）`
        : '正在自动压缩背景信息';
    return (
      <div className="chatx-compression-divider" title={message.card.summary || message.content}>
        <span className="chatx-compression-divider__line" aria-hidden="true" />
        <span className="chatx-compression-divider__label">{label}</span>
        <span className="chatx-compression-divider__line" aria-hidden="true" />
      </div>
    );
  }

  if (message.card?.type === 'evidence_digest') {
    return <EvidenceCard card={message.card} />;
  }

  if (message.card?.type === 'learning_summary') {
    return <LearningSummaryCard card={message.card} />;
  }

  if (message.card?.type === 'skill_reuse') {
    return <SkillReuseCard card={message.card} />;
  }

  if (message.card?.type === 'worker_dispatch') {
    return <WorkerDispatchCard card={message.card} />;
  }

  if (message.card?.type === 'runtime_issue') {
    return <RuntimeIssueCard card={message.card} />;
  }

  if (message.card?.type === 'skill_suggestions') {
    return <SkillSuggestionsCard card={message.card} onSkillInstall={options.onSkillInstall} />;
  }

  if (message.card?.type === 'capability_catalog') {
    return (
      <div className="chatx-structured-card">
        <div className="chatx-structured-card__header">
          <Tag color="blue">{message.card.title}</Tag>
          <Tag>{message.card.groups.reduce((count, group) => count + group.items.length, 0)} 项</Tag>
        </div>
        {message.card.summary ? <div className="chatx-structured-card__desc">{message.card.summary}</div> : null}
        <div className="chatx-structured-card__list">
          {message.card.groups.map(group => (
            <article key={group.key} className="chatx-structured-card__item">
              <div className="chatx-structured-card__title">{group.label}</div>
              <div className="chatx-structured-card__list">
                {group.items.map(item => (
                  <article key={item.id} className="chatx-structured-card__item">
                    <div className="chatx-structured-card__meta">
                      <Tag color={getCapabilityCatalogTagColor(group.kind)}>{group.kind}</Tag>
                      {item.ownerType ? <Tag>{item.ownerType}</Tag> : null}
                      {item.family ? <Tag color="blue">{item.family}</Tag> : null}
                      {item.capabilityType ? <Tag color="gold">{item.capabilityType}</Tag> : null}
                      {item.scope ? <Tag>{item.scope}</Tag> : null}
                      {item.bootstrap ? <Tag color="gold">bootstrap</Tag> : null}
                      {item.status ? (
                        <Tag color={item.enabled === false ? 'default' : 'green'}>{item.status}</Tag>
                      ) : null}
                    </div>
                    <div className="chatx-structured-card__title">{item.displayName}</div>
                    {item.summary ? <div className="chatx-structured-card__desc">{item.summary}</div> : null}
                    {item.sourceLabel ? (
                      <div className="chatx-structured-card__desc">来源：{item.sourceLabel}</div>
                    ) : null}
                    {item.preferredMinistries?.length ? (
                      <div className="chatx-structured-card__desc">
                        优先六部：{item.preferredMinistries.join(' / ')}
                      </div>
                    ) : null}
                    {item.blockedReason ? (
                      <div className="chatx-structured-card__desc">阻塞原因：{item.blockedReason}</div>
                    ) : null}
                  </article>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (message.card?.type === 'skill_draft_created') {
    return (
      <div className="chatx-structured-card">
        <div className="chatx-structured-card__header">
          <Tag color="green">Skill Draft</Tag>
          <Tag>{message.card.status}</Tag>
          <Tag>{message.card.ownerType}</Tag>
        </div>
        <div className="chatx-structured-card__list">
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">{message.card.displayName}</div>
            <div className="chatx-structured-card__desc">{message.card.description}</div>
            <div className="chatx-structured-card__desc">
              scope={message.card.scope} · {message.card.enabled ? '已启用' : '未启用'}
            </div>
            <div className="chatx-structured-card__desc">Skill ID: {message.card.skillId}</div>
          </article>
          {message.card.contract ? (
            <article className="chatx-structured-card__item">
              <div className="chatx-structured-card__title">执行 Contract</div>
              <div className="chatx-structured-card__meta">
                {message.card.contract.requiredTools.map(tool => (
                  <Tag key={`required:${tool}`} color="geekblue">
                    必需工具 · {tool}
                  </Tag>
                ))}
                {message.card.contract.optionalTools.map(tool => (
                  <Tag key={`optional:${tool}`}>可选工具 · {tool}</Tag>
                ))}
                {message.card.contract.approvalSensitiveTools.map(tool => (
                  <Tag key={`approval:${tool}`} color="orange">
                    审批敏感 · {tool}
                  </Tag>
                ))}
                {message.card.contract.preferredConnectors.map(connector => (
                  <Tag key={`preferred-connector:${connector}`} color="purple">
                    优先连接器 · {connector}
                  </Tag>
                ))}
                {message.card.contract.requiredConnectors.map(connector => (
                  <Tag key={`required-connector:${connector}`} color="red">
                    必需连接器 · {connector}
                  </Tag>
                ))}
              </div>
            </article>
          ) : null}
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">下一步</div>
            <div className="chatx-structured-card__meta">
              {message.card.nextActions.map(action => (
                <Tag key={action} color="blue">
                  {action}
                </Tag>
              ))}
            </div>
          </article>
        </div>
      </div>
    );
  }

  if (message.role === 'assistant' || message.role === 'system') {
    if (message.role === 'assistant' && streaming && !message.content.trim()) {
      return (
        <div className="chatx-stream-placeholder" aria-live="polite">
          <span className="chatx-stream-placeholder__dot" aria-hidden="true" />
          <span className="chatx-stream-placeholder__copy">正在生成回复...</span>
        </div>
      );
    }

    const inlineEvidenceSources = options.inlineEvidenceSources ?? [];
    const shouldRenderInlineSources =
      message.role === 'assistant' && hasInlineSourceReferences(message.content) && inlineEvidenceSources.length > 0;
    const markdownComponents = shouldRenderInlineSources
      ? {
          sup: createInlineSourceSupComponent(inlineEvidenceSources)
        }
      : undefined;
    return (
      <div className={`chatx-markdown-shell ${message.role === 'system' ? 'is-system' : 'is-assistant'}`}>
        <XMarkdown
          content={message.content}
          streaming={streaming ? { hasNextChunk: true, tail: true } : undefined}
          openLinksInNewTab
          escapeRawHtml
          className="chatx-markdown"
          components={markdownComponents}
        />
      </div>
    );
  }

  return <div className="chatx-plain-message">{message.content}</div>;
}
