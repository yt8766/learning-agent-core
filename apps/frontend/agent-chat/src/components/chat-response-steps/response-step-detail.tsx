import type { ChatResponseStepRecord } from '@agent/core';

type ResponseStepDetailProps = {
  step: ChatResponseStepRecord;
};

export function ResponseStepDetail({ step }: ResponseStepDetailProps) {
  const transition = [step.fromNodeId ?? step.nodeId, step.toNodeId].filter(Boolean).join(' → ');
  const ownerLabel = step.ownerLabel ?? resolveAgentScopeLabel(step.agentScope);
  return (
    <li className={`chat-response-steps__item is-${step.status}`}>
      <span className="chat-response-steps__status" aria-hidden="true" />
      <span className="chat-response-steps__meta">
        {ownerLabel ? <span className="chat-response-steps__tag">{ownerLabel}</span> : null}
        {step.agentLabel ? <span className="chat-response-steps__tag">{step.agentLabel}</span> : null}
        {step.nodeLabel ? <span className="chat-response-steps__node">{step.nodeLabel}</span> : null}
      </span>
      <span className="chat-response-steps__title">{step.title}</span>
      {step.detail ? <span className="chat-response-steps__detail">{step.detail}</span> : null}
      {transition ? <span className="chat-response-steps__detail">节点：{transition}</span> : null}
    </li>
  );
}

function resolveAgentScopeLabel(scope: ChatResponseStepRecord['agentScope']) {
  if (scope === 'sub') return '子 Agent';
  if (scope === 'system') return '系统';
  if (scope === 'main') return '主 Agent';
  return '';
}
