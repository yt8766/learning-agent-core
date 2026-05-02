import type { ChatResponseStepsForMessage } from '@/lib/chat-response-step-projections';

import { ResponseStepDetail } from './response-step-detail';

type ResponseStepSummaryProps = {
  responseSteps: ChatResponseStepsForMessage;
};

export function ResponseStepSummary({ responseSteps }: ResponseStepSummaryProps) {
  return (
    <details className="chat-response-steps chat-response-steps--complete">
      <summary className="chat-response-steps__complete-summary">
        <span>{responseSteps.summary.title}</span>
        <span className="chat-response-steps__chevron" aria-hidden="true">
          ›
        </span>
      </summary>
      <ol className="chat-response-steps__list">
        {responseSteps.steps.map(step => (
          <ResponseStepDetail key={step.id} step={step} />
        ))}
      </ol>
    </details>
  );
}
