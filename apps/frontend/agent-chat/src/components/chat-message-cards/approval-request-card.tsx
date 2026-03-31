import { Button, Space, Tag } from 'antd';
import { XMarkdown } from '@ant-design/x-markdown';

import {
  getApprovalDisplayStatusMeta,
  getApprovalReasonLabel,
  getIntentLabel,
  getInterruptModeLabel,
  getInterruptSourceLabel,
  getResumeStrategyLabel,
  getRiskLabel,
  getRiskTagColor,
  type ApprovalRequestCardData
} from './card-meta';

interface ApprovalRequestCardProps {
  card: ApprovalRequestCardData;
  content: string;
  onApprovalAction?: (intent: string, approved: boolean) => void;
  onApprovalFeedback?: (intent: string, reason?: string) => void;
}

export function ApprovalRequestCard(props: ApprovalRequestCardProps) {
  const { card, content, onApprovalAction, onApprovalFeedback } = props;
  const summary = card.reason ?? content;
  const displayStatusMeta = getApprovalDisplayStatusMeta(card.displayStatus);
  const isHandled =
    card.isPrimaryActionAvailable === false ||
    card.status === 'approved' ||
    card.status === 'rejected' ||
    card.status === 'allowed';

  return (
    <div className="chatx-approval-card">
      <div className="chatx-approval-card__header">
        <div className="chatx-approval-card__title-wrap">
          <div className="chatx-approval-card__eyebrow">操作确认</div>
          <div className="chatx-approval-card__title">允许继续执行此操作</div>
        </div>
        <Tag color={getRiskTagColor(card.riskLevel)}>{getRiskLabel(card.riskLevel)}</Tag>
      </div>

      <div className="chatx-approval-card__summary">这一步需要你的确认才能继续。将执行的操作、工具和风险原因如下。</div>

      <div className="chatx-approval-card__reason">
        <div className="chatx-approval-card__reason-label">原因</div>
        <div className="chatx-markdown-shell is-system chatx-approval-card__body">
          <XMarkdown content={summary} className="chatx-markdown" escapeRawHtml />
        </div>
      </div>

      <details className="chatx-approval-card__details">
        <summary className="chatx-approval-card__details-toggle">查看详情</summary>
        <div className="chatx-approval-card__details-body">
          <div className="chatx-approval-card__facts">
            <div className="chatx-approval-card__fact">
              <span className="chatx-approval-card__fact-label">动作</span>
              <code className="chatx-approval-card__fact-value">{getIntentLabel(card.intent)}</code>
            </div>
            <div className="chatx-approval-card__fact">
              <span className="chatx-approval-card__fact-label">工具</span>
              <code className="chatx-approval-card__fact-value">{card.toolName ?? '待确认工具'}</code>
            </div>
            {card.requestedBy ? (
              <div className="chatx-approval-card__fact">
                <span className="chatx-approval-card__fact-label">发起方</span>
                <span className="chatx-approval-card__fact-text">{card.requestedBy}</span>
              </div>
            ) : null}
            {card.resumeStrategy ? (
              <div className="chatx-approval-card__fact">
                <span className="chatx-approval-card__fact-label">恢复方式</span>
                <span className="chatx-approval-card__fact-text">{getResumeStrategyLabel(card.resumeStrategy)}</span>
              </div>
            ) : null}
            {card.interruptSource ? (
              <div className="chatx-approval-card__fact">
                <span className="chatx-approval-card__fact-label">中断来源</span>
                <span className="chatx-approval-card__fact-text">{getInterruptSourceLabel(card.interruptSource)}</span>
              </div>
            ) : null}
            {card.interruptMode ? (
              <div className="chatx-approval-card__fact">
                <span className="chatx-approval-card__fact-label">中断模式</span>
                <span className="chatx-approval-card__fact-text">{getInterruptModeLabel(card.interruptMode)}</span>
              </div>
            ) : null}
          </div>

          {card.preview?.length ? (
            <div className="chatx-approval-card__preview">
              <div className="chatx-approval-card__reason-label">将要执行</div>
              <div className="chatx-approval-card__preview-list">
                {card.preview.map(item => (
                  <div key={`${item.label}:${item.value}`} className="chatx-approval-card__preview-item">
                    <span className="chatx-approval-card__preview-label">{item.label}</span>
                    <code className="chatx-approval-card__preview-value">{item.value}</code>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </details>

      <div className="chatx-approval-card__meta">
        <Tag>{card.intent}</Tag>
        {card.requestedBy ? <Tag>{card.requestedBy}</Tag> : null}
        {card.reasonCode ? <Tag color="purple">{getApprovalReasonLabel(card.reasonCode)}</Tag> : null}
        {card.interruptSource ? <Tag color="cyan">{getInterruptSourceLabel(card.interruptSource)}</Tag> : null}
        {card.interruptMode ? <Tag color="blue">{getInterruptModeLabel(card.interruptMode)}</Tag> : null}
        {card.resumeStrategy ? (
          <Tag color={card.resumeStrategy === 'command' ? 'geekblue' : 'default'}>
            {getResumeStrategyLabel(card.resumeStrategy)}
          </Tag>
        ) : null}
        <Tag color={displayStatusMeta.color}>{displayStatusMeta.label}</Tag>
      </div>
      <Space wrap className="chatx-approval-card__actions">
        <Button size="small" type="primary" disabled={isHandled} onClick={() => onApprovalAction?.(card.intent, true)}>
          允许继续
        </Button>
        <Button size="small" disabled={isHandled} onClick={() => onApprovalAction?.(card.intent, false)}>
          拒绝
        </Button>
        <Button
          size="small"
          type="text"
          disabled={isHandled}
          onClick={() => onApprovalFeedback?.(card.intent, card.reason)}
        >
          添加说明
        </Button>
      </Space>
    </div>
  );
}
