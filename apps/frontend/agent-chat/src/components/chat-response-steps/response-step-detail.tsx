import type { ChatResponseStepRecord } from '@agent/core';

type ResponseStepDetailProps = {
  step: ChatResponseStepRecord;
};

export function ResponseStepDetail({ step }: ResponseStepDetailProps) {
  return (
    <li className={`chat-response-steps__item is-${step.status}`}>
      <span className="chat-response-steps__status" aria-hidden="true" />
      <span className="chat-response-steps__title">{step.title}</span>
      {step.detail ? <span className="chat-response-steps__detail">{step.detail}</span> : null}
    </li>
  );
}
