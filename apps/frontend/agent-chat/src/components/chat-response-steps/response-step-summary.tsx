import type { ChatResponseStepsForMessage } from '@/lib/chat-response-step-projections';

import { ResponseStepDetail } from './response-step-detail';

type ResponseStepSummaryProps = {
  responseSteps: ChatResponseStepsForMessage;
};

export function ResponseStepSummary({ responseSteps }: ResponseStepSummaryProps) {
  if (responseSteps.status === 'completed' && responseSteps.displayMode === 'answer_only') {
    return null;
  }

  const stepGroups =
    responseSteps.agentOsGroups && responseSteps.agentOsGroups.length > 0 ? responseSteps.agentOsGroups : null;

  return (
    <details className="chat-response-steps chat-response-steps--complete">
      <summary className="chat-response-steps__complete-summary">
        <span>{buildResponseStepSummaryTitle(responseSteps)}</span>
        <span className="chat-response-steps__chevron" aria-hidden="true">
          ›
        </span>
      </summary>
      <ol className="chat-response-steps__list">
        {stepGroups
          ? stepGroups.flatMap(group => [
              <li key={`${group.kind}:heading`} className="chat-response-steps__item is-group-heading">
                <span className="chat-response-steps__title">{group.title}</span>
              </li>,
              ...group.steps.map(step => <ResponseStepDetail key={step.id} step={step} />)
            ])
          : responseSteps.steps.map(step => <ResponseStepDetail key={step.id} step={step} />)}
      </ol>
    </details>
  );
}

export function buildResponseStepSummaryTitle(responseSteps: ChatResponseStepsForMessage) {
  if (responseSteps.summary.title.includes('用时')) {
    return responseSteps.summary.title;
  }
  const duration = formatResponseStepsDuration(responseSteps.steps);
  return duration ? `${responseSteps.summary.title} · 用时 ${duration}` : responseSteps.summary.title;
}

function formatResponseStepsDuration(steps: ChatResponseStepsForMessage['steps']) {
  const durationMs = steps.reduce((total, step) => total + (step.durationMs ?? 0), 0);
  if (durationMs <= 0) {
    return '';
  }
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
