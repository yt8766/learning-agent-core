import { Button, Space, Tag } from 'antd';
import type { BubbleItemType, ThoughtChainItemType } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';

import type { ChatMessageRecord, ChatSessionRecord, ChatThinkState } from '../../types/chat';

export type AgentLabelResolver = (role?: string) => string;

export interface BuildBubbleItemsOptions {
  messages: ChatMessageRecord[];
  activeStatus?: ChatSessionRecord['status'];
  /** 与 checkpoint.thinkState.loading 对齐，避免会话状态尚未推成 running 时不显示 typing */
  agentThinking?: boolean;
  copiedMessageId?: string;
  onCopy: (message: ChatMessageRecord) => void;
  onApprovalAction?: (intent: string, approved: boolean) => void;
  onApprovalFeedback?: (intent: string, reason?: string) => void;
  getAgentLabel: AgentLabelResolver;
  runningHint?: string;
  /** 作为 Agent 消息插入到最后一条用户气泡之后 */
  thinkState?: ChatThinkState;
  thoughtItems?: ThoughtChainItemType[];
}

function CopyGlyph({ copied }: { copied: boolean }) {
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

function renderMessageContent(
  message: ChatMessageRecord,
  streaming: boolean,
  options: Pick<BuildBubbleItemsOptions, 'onApprovalAction' | 'onApprovalFeedback'>
) {
  if (message.card?.type === 'approval_request') {
    const approvalCard = message.card;
    return (
      <div className="chatx-approval-card">
        <div className="chatx-markdown-shell is-system">
          <XMarkdown content={message.content} className="chatx-markdown" escapeRawHtml />
        </div>
        <div className="chatx-approval-card__meta">
          <Tag
            color={approvalCard.riskLevel === 'high' ? 'red' : approvalCard.riskLevel === 'medium' ? 'orange' : 'blue'}
          >
            {approvalCard.riskLevel ?? 'unknown'}
          </Tag>
          {approvalCard.toolName ? <Tag>{approvalCard.toolName}</Tag> : null}
          {approvalCard.requestedBy ? <Tag>{approvalCard.requestedBy}</Tag> : null}
        </div>
        <Space wrap>
          <Button size="small" type="primary" onClick={() => options.onApprovalAction?.(approvalCard.intent, true)}>
            准奏
          </Button>
          <Button size="small" onClick={() => options.onApprovalAction?.(approvalCard.intent, false)}>
            驳回
          </Button>
          <Button
            size="small"
            type="dashed"
            onClick={() => options.onApprovalFeedback?.(approvalCard.intent, approvalCard.reason)}
          >
            打回并批注
          </Button>
        </Space>
      </div>
    );
  }

  if (message.card?.type === 'evidence_digest') {
    return (
      <div className="chatx-structured-card">
        <div className="chatx-structured-card__header">
          <Tag color="blue">Evidence</Tag>
          <Tag>{message.card.sources.length} 条来源</Tag>
        </div>
        <div className="chatx-structured-card__list">
          {message.card.sources.map(source => (
            <article key={source.id} className="chatx-structured-card__item">
              <div className="chatx-structured-card__meta">
                <Tag color={source.sourceType === 'freshness_meta' ? 'orange' : undefined}>
                  {source.sourceType === 'freshness_meta' ? 'freshness' : source.sourceType}
                </Tag>
                <Tag color="blue">{source.trustClass}</Tag>
              </div>
              <div className="chatx-structured-card__title">{source.summary}</div>
              <div className="chatx-structured-card__desc">
                {source.sourceType === 'freshness_meta'
                  ? `基准时间：${typeof source.detail?.referenceTime === 'string' ? source.detail.referenceTime : (source.fetchedAt ?? 'unknown')}`
                  : (source.sourceUrl ?? 'internal-source')}
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (message.card?.type === 'learning_summary') {
    return (
      <div className="chatx-structured-card">
        <div className="chatx-structured-card__header">
          <Tag color="gold">Learning</Tag>
          <Tag>score {message.card.score}</Tag>
          <Tag>{message.card.confidence}</Tag>
        </div>
        <div className="chatx-structured-card__list">
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">学习建议</div>
            <div className="chatx-structured-card__desc">
              {message.card.notes.length ? message.card.notes.join('；') : '当前暂无额外学习说明。'}
            </div>
            <div className="chatx-structured-card__meta">
              <Tag color="purple">推荐 {message.card.recommendedCount}</Tag>
              <Tag color="green">自动确认 {message.card.autoConfirmCount}</Tag>
            </div>
          </article>
          {message.card.skillGovernanceRecommendations.length ? (
            <article className="chatx-structured-card__item">
              <div className="chatx-structured-card__title">技能治理建议</div>
              <div className="chatx-structured-card__meta">
                {message.card.skillGovernanceRecommendations.map(item => (
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

  if (message.card?.type === 'skill_reuse') {
    return (
      <div className="chatx-structured-card">
        <div className="chatx-structured-card__header">
          <Tag color="purple">Skill Reuse</Tag>
        </div>
        <div className="chatx-structured-card__list">
          {message.card.reusedSkills.length ? (
            <article className="chatx-structured-card__item">
              <div className="chatx-structured-card__title">复用技能</div>
              <div className="chatx-structured-card__meta">
                {message.card.reusedSkills.map(item => (
                  <Tag key={item}>{item}</Tag>
                ))}
              </div>
            </article>
          ) : null}
          {message.card.usedInstalledSkills.length ? (
            <article className="chatx-structured-card__item">
              <div className="chatx-structured-card__title">已安装技能</div>
              <div className="chatx-structured-card__meta">
                {message.card.usedInstalledSkills.map(item => (
                  <Tag key={item} color="blue">
                    {item}
                  </Tag>
                ))}
              </div>
            </article>
          ) : null}
          {message.card.usedCompanyWorkers.length ? (
            <article className="chatx-structured-card__item">
              <div className="chatx-structured-card__title">公司专员</div>
              <div className="chatx-structured-card__meta">
                {message.card.usedCompanyWorkers.map(item => (
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

  if (message.card?.type === 'worker_dispatch') {
    return (
      <div className="chatx-structured-card">
        <div className="chatx-structured-card__header">
          <Tag color="cyan">Worker Dispatch</Tag>
          {message.card.currentMinistry ? <Tag>{message.card.currentMinistry}</Tag> : null}
          {message.card.chatRoute ? <Tag color="geekblue">{message.card.chatRoute.flow}</Tag> : null}
        </div>
        <div className="chatx-structured-card__list">
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">{message.card.currentWorker ?? '尚未命中具体执行官'}</div>
            <div className="chatx-structured-card__desc">
              {message.card.routeReason ?? '当前执行路线已由吏部确认，并会继续沿着这条能力链推进。'}
            </div>
            {message.card.chatRoute ? (
              <div className="chatx-structured-card__meta">
                <Tag>{message.card.chatRoute.adapter}</Tag>
                <Tag color="blue">priority {message.card.chatRoute.priority}</Tag>
                <Tag color="purple">{message.card.chatRoute.reason}</Tag>
              </div>
            ) : null}
          </article>
          {message.card.usedInstalledSkills.length ? (
            <article className="chatx-structured-card__item">
              <div className="chatx-structured-card__title">命中的已安装技能</div>
              <div className="chatx-structured-card__meta">
                {message.card.usedInstalledSkills.map(item => (
                  <Tag key={item} color="blue">
                    {item}
                  </Tag>
                ))}
              </div>
            </article>
          ) : null}
          {message.card.usedCompanyWorkers.length ? (
            <article className="chatx-structured-card__item">
              <div className="chatx-structured-card__title">命中的公司专员</div>
              <div className="chatx-structured-card__meta">
                {message.card.usedCompanyWorkers.map(item => (
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

  if (message.card?.type === 'runtime_issue') {
    return (
      <div className="chatx-structured-card">
        <div className="chatx-structured-card__header">
          <Tag color={message.card.severity === 'error' ? 'red' : 'orange'}>Runtime Issue</Tag>
          <Tag>{message.card.title}</Tag>
        </div>
        <div className="chatx-structured-card__list">
          <article className="chatx-structured-card__item">
            <div className="chatx-structured-card__title">模型调用已回退到兜底回复</div>
            <div className="chatx-structured-card__desc">
              {message.card.notes.length ? message.card.notes.join('；') : '当前没有更多运行时说明。'}
            </div>
          </article>
        </div>
      </div>
    );
  }

  if (message.card?.type === 'skill_suggestions') {
    return (
      <div className="chatx-structured-card">
        <div className="chatx-structured-card__header">
          <Tag color={message.card.capabilityGapDetected ? 'orange' : 'blue'}>
            {message.card.capabilityGapDetected ? 'Capability Gap' : 'Local Skills'}
          </Tag>
          <Tag>{message.card.status}</Tag>
          <Tag>{message.card.suggestions.length} 个候选</Tag>
        </div>
        <div className="chatx-structured-card__list">
          {message.card.safetyNotes.length ? (
            <article className="chatx-structured-card__item">
              <div className="chatx-structured-card__title">安全评估</div>
              <div className="chatx-structured-card__desc">{message.card.safetyNotes.join('；')}</div>
            </article>
          ) : null}
          {message.card.suggestions.map(item => (
            <article key={`${item.kind}:${item.id}`} className="chatx-structured-card__item">
              <div className="chatx-structured-card__meta">
                <Tag>{item.kind}</Tag>
                <Tag
                  color={
                    item.availability === 'ready'
                      ? 'green'
                      : item.availability === 'installable' ||
                          item.availability === 'installable-local' ||
                          item.availability === 'installable-remote'
                        ? 'blue'
                        : item.availability === 'approval-required'
                          ? 'orange'
                          : 'red'
                  }
                >
                  {item.availability}
                </Tag>
                {item.safety ? (
                  <Tag
                    color={
                      item.safety.verdict === 'allow'
                        ? 'green'
                        : item.safety.verdict === 'needs-approval'
                          ? 'orange'
                          : 'red'
                    }
                  >
                    {item.safety.verdict}
                  </Tag>
                ) : null}
                {item.safety ? <Tag color="gold">trust {item.safety.trustScore}</Tag> : null}
                {item.version ? <Tag>{item.version}</Tag> : null}
                {item.sourceLabel ? <Tag color="cyan">{item.sourceLabel}</Tag> : null}
                {typeof item.successRate === 'number' ? (
                  <Tag color="green">success {(item.successRate * 100).toFixed(0)}%</Tag>
                ) : null}
                {item.governanceRecommendation ? <Tag color="gold">{item.governanceRecommendation}</Tag> : null}
              </div>
              <div className="chatx-structured-card__title">{item.displayName}</div>
              <div className="chatx-structured-card__desc">{item.summary}</div>
              <div className="chatx-structured-card__desc">{item.reason}</div>
              {item.safety?.reasons.length ? (
                <div className="chatx-structured-card__desc">{item.safety.reasons.join('；')}</div>
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
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (message.role === 'assistant' || message.role === 'system') {
    return (
      <div className={`chatx-markdown-shell ${message.role === 'system' ? 'is-system' : 'is-assistant'}`}>
        <XMarkdown
          content={message.content}
          streaming={streaming ? { hasNextChunk: true, tail: true } : undefined}
          openLinksInNewTab
          escapeRawHtml
          className="chatx-markdown"
        />
      </div>
    );
  }

  return <div className="chatx-plain-message">{message.content}</div>;
}

function shouldRenderInMainThread(message: ChatMessageRecord) {
  if (message.role === 'user' || message.role === 'assistant') {
    return true;
  }

  if (!message.card) {
    return false;
  }

  return message.card.type === 'approval_request' || message.card.type === 'run_cancelled';
}

function collapseMainThreadMessages(messages: ChatMessageRecord[]) {
  const collapsed: ChatMessageRecord[] = [];

  for (const message of messages) {
    const previous = collapsed[collapsed.length - 1];
    const canMergeAssistantText =
      previous && previous.role === 'assistant' && message.role === 'assistant' && !previous.card && !message.card;

    if (canMergeAssistantText) {
      collapsed[collapsed.length - 1] = {
        ...previous,
        id: message.id,
        content: mergeAssistantText(previous.content, message.content),
        createdAt: message.createdAt,
        linkedAgent: message.linkedAgent ?? previous.linkedAgent
      };
      continue;
    }

    collapsed.push(message);
  }

  return collapsed;
}

function mergeAssistantText(previousContent: string, nextContent: string) {
  const previousTrimmed = previousContent.trim();
  const nextTrimmed = nextContent.trim();

  if (!previousTrimmed) {
    return nextContent;
  }

  if (!nextTrimmed) {
    return previousContent;
  }

  if (previousTrimmed === nextTrimmed) {
    return nextContent;
  }

  if (nextTrimmed.startsWith(previousTrimmed)) {
    return nextContent;
  }

  if (previousTrimmed.startsWith(nextTrimmed)) {
    return previousContent;
  }

  const overlap = findSuffixPrefixOverlap(previousTrimmed, nextTrimmed);
  if (overlap >= 24) {
    return `${previousTrimmed}${nextTrimmed.slice(overlap)}`;
  }

  return `${previousContent}${previousContent && nextContent ? '\n\n' : ''}${nextContent}`;
}

function findSuffixPrefixOverlap(left: string, right: string) {
  const maxOverlap = Math.min(left.length, right.length);
  for (let size = maxOverlap; size > 0; size -= 1) {
    if (left.slice(-size) === right.slice(0, size)) {
      return size;
    }
  }
  return 0;
}

export function buildBubbleItems({
  messages,
  activeStatus,
  agentThinking,
  copiedMessageId,
  onCopy,
  onApprovalAction,
  onApprovalFeedback,
  getAgentLabel
}: BuildBubbleItemsOptions): BubbleItemType[] {
  const mainThreadMessages = collapseMainThreadMessages(messages.filter(shouldRenderInMainThread));
  const lastAssistantMessageId = [...mainThreadMessages].reverse().find(message => message.role === 'assistant')?.id;

  const items: BubbleItemType[] = mainThreadMessages.map(message => {
    const isStreamingAssistant =
      message.id === lastAssistantMessageId && (activeStatus === 'running' || Boolean(agentThinking));

    return {
      key: message.id,
      role: message.role === 'user' ? 'user' : message.role === 'assistant' ? 'ai' : 'system',
      content: renderMessageContent(message, isStreamingAssistant, { onApprovalAction, onApprovalFeedback }),
      header:
        message.role === 'system' && message.linkedAgent ? (
          <Tag color="geekblue">{getAgentLabel(message.linkedAgent)}</Tag>
        ) : undefined,
      footer:
        message.role === 'assistant' ? (
          <div className="chatx-bubble-footer">
            <Button
              size="small"
              type="text"
              className="chatx-copy-button"
              icon={<CopyGlyph copied={copiedMessageId === message.id} />}
              onClick={() => onCopy(message)}
              aria-label={copiedMessageId === message.id ? '已复制' : '复制消息'}
            />
          </div>
        ) : undefined,
      footerPlacement: message.role === 'user' ? 'outer-end' : 'outer-start',
      placement: message.role === 'user' ? 'end' : 'start',
      variant: message.role === 'user' ? 'filled' : message.role === 'system' ? 'outlined' : 'shadow',
      shape: 'round',
      typing: isStreamingAssistant,
      streaming: isStreamingAssistant
    };
  });

  return items;
}
