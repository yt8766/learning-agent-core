import type { ChatResponseStepRecord } from '@agent/core';

type AgentOsStepItemProps = {
  step: ChatResponseStepRecord;
};

export function AgentOsStepItem({ step }: AgentOsStepItemProps) {
  const targetLabel = resolveTargetLabel(step.target);

  return (
    <li className={`chat-response-steps__agent-os-step is-${step.status}`}>
      <span className="chat-response-steps__agent-os-status" aria-hidden="true" />
      <span className="chat-response-steps__agent-os-step-body">
        <span className="chat-response-steps__agent-os-step-title">{step.title}</span>
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
