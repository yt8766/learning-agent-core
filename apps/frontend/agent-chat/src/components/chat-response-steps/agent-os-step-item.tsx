import type { ChatResponseStepRecord } from '@agent/core';

type AgentOsStepItemProps = {
  step: ChatResponseStepRecord;
};

export function AgentOsStepItem({ step }: AgentOsStepItemProps) {
  const targetLabel = resolveTargetLabel(step.target);
  const statusLabel = responseStepStatusLabel(step.status);

  return (
    <li className={`chat-response-steps__agent-os-step is-${step.status}`} aria-label={`${statusLabel}：${step.title}`}>
      <span className="chat-response-steps__agent-os-status" aria-hidden="true" />
      <span className="chat-response-steps__agent-os-step-body">
        <span className="chat-response-steps__agent-os-step-title">
          <span className="chat-response-steps__agent-os-step-state">{statusLabel}</span>
          {step.title}
        </span>
        {step.detail ? <span className="chat-response-steps__agent-os-step-detail">{step.detail}</span> : null}
        {targetLabel ? <code className="chat-response-steps__agent-os-target">{targetLabel}</code> : null}
      </span>
    </li>
  );
}

function resolveTargetLabel(target: ChatResponseStepRecord['target']) {
  if (!target) {
    return '';
  }
  if (target.kind === 'file') {
    return target.path || target.label;
  }
  if (target.kind === 'command' || target.kind === 'test') {
    return target.label;
  }
  return '';
}

function responseStepStatusLabel(status: ChatResponseStepRecord['status']) {
  switch (status) {
    case 'queued':
      return '等待中';
    case 'running':
      return '处理中';
    case 'completed':
      return '已完成';
    case 'blocked':
      return '已阻断';
    case 'failed':
      return '失败';
    case 'cancelled':
      return '已取消';
  }
}
