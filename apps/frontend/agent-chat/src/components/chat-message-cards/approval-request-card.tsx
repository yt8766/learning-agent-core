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
  onApprovalAction?: (intent: string, approved: boolean, scope?: 'once' | 'session' | 'always') => void;
  onApprovalFeedback?: (intent: string, reason?: string) => void;
}

export function ApprovalRequestCard(props: ApprovalRequestCardProps) {
  const { card, content, onApprovalAction, onApprovalFeedback } = props;
  const summary = card.reason ?? content;
  const riskSummary = card.riskReason ?? summary;
  const displayStatusMeta = getApprovalDisplayStatusMeta(card.displayStatus);
  const isRuntimeGovernance = card.interactionKind === 'supplemental-input' && card.watchdog;
  const title = isRuntimeGovernance ? '兵部运行时操作需要处理' : '允许继续执行此操作';
  const eyebrow = isRuntimeGovernance ? '运行时治理中断' : '操作确认';
  const summaryCopy = isRuntimeGovernance
    ? '这一步不是普通高风险审批，而是兵部执行链在超时、等待输入或交互卡死时触发的运行时治理中断。'
    : '这一步需要你的确认才能继续。将执行的操作、来源与高危原因如下。';
  const isHandled =
    card.isPrimaryActionAvailable === false ||
    card.status === 'approved' ||
    card.status === 'rejected' ||
    card.status === 'allowed';

  return (
    <div className="chatx-approval-card">
      <div className="chatx-approval-card__header">
        <div className="chatx-approval-card__title-wrap">
          <div className="chatx-approval-card__eyebrow">{eyebrow}</div>
          <div className="chatx-approval-card__title">{title}</div>
        </div>
        <Tag color={getRiskTagColor(card.riskLevel)}>{getRiskLabel(card.riskLevel)}</Tag>
      </div>

      <div className="chatx-approval-card__summary">{summaryCopy}</div>

      <div className="chatx-approval-card__reason">
        <div className="chatx-approval-card__reason-label">高危摘要</div>
        <div className="chatx-markdown-shell is-system chatx-approval-card__body">
          <XMarkdown content={riskSummary} className="chatx-markdown" escapeRawHtml />
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
                <span className="chatx-approval-card__fact-label">来源部门</span>
                <span className="chatx-approval-card__fact-text">{card.requestedBy}</span>
              </div>
            ) : null}
            <div className="chatx-approval-card__fact">
              <span className="chatx-approval-card__fact-label">审批范围</span>
              <span className="chatx-approval-card__fact-text">
                {card.approvalScope === 'always'
                  ? '永远允许（预留）'
                  : card.approvalScope === 'session'
                    ? '本会话（预留）'
                    : '仅本次'}
              </span>
            </div>
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
            {card.runtimeGovernanceReasonCode ? (
              <div className="chatx-approval-card__fact">
                <span className="chatx-approval-card__fact-label">治理原因</span>
                <span className="chatx-approval-card__fact-text">
                  {getApprovalReasonLabel(card.runtimeGovernanceReasonCode) || card.runtimeGovernanceReasonCode}
                </span>
              </div>
            ) : null}
          </div>

          {card.commandPreview ? (
            <div className="chatx-approval-card__preview">
              <div className="chatx-approval-card__reason-label">命令预览</div>
              <code className="chatx-approval-card__preview-value">{card.commandPreview}</code>
            </div>
          ) : null}

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

          {card.recommendedActions?.length ? (
            <div className="chatx-approval-card__preview">
              <div className="chatx-approval-card__reason-label">推荐动作</div>
              <div className="chatx-approval-card__preview-list">
                {card.recommendedActions.map(action => (
                  <div key={action} className="chatx-approval-card__preview-item">
                    <span className="chatx-approval-card__preview-label">建议</span>
                    <code className="chatx-approval-card__preview-value">{action}</code>
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
        {isRuntimeGovernance ? <Tag color="volcano">runtime-governance</Tag> : null}
        {card.watchdog ? <Tag color="orange">watchdog</Tag> : null}
        {card.reasonCode ? <Tag color="purple">{getApprovalReasonLabel(card.reasonCode)}</Tag> : null}
        {card.runtimeGovernanceReasonCode ? (
          <Tag color="purple">{getApprovalReasonLabel(card.runtimeGovernanceReasonCode)}</Tag>
        ) : null}
        {card.riskCode && card.riskCode !== card.reasonCode ? (
          <Tag color="magenta">{getApprovalReasonLabel(card.riskCode) || card.riskCode}</Tag>
        ) : null}
        <Tag color="gold">
          {card.approvalScope === 'always'
            ? '永远允许（预留）'
            : card.approvalScope === 'session'
              ? '本会话（预留）'
              : '仅本次'}
        </Tag>
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
        <Button
          size="small"
          type="primary"
          disabled={isHandled}
          onClick={() => onApprovalAction?.(card.intent, true, 'once')}
        >
          允许本次
        </Button>
        <Button size="small" disabled={isHandled} onClick={() => onApprovalAction?.(card.intent, true, 'session')}>
          本会话允许
        </Button>
        <Button size="small" disabled={isHandled} onClick={() => onApprovalAction?.(card.intent, true, 'always')}>
          永久允许
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
