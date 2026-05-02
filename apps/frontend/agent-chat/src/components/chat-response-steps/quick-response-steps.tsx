import type { ChatResponseStepsForMessage } from '@/lib/chat-response-step-projections';

type QuickResponseStepsProps = {
  responseSteps: ChatResponseStepsForMessage;
};

export function QuickResponseSteps({ responseSteps }: QuickResponseStepsProps) {
  return (
    <div className="chat-response-steps chat-response-steps--quick" aria-label="AI response steps">
      <div className="chat-response-steps__summary">{responseSteps.summary.title}</div>
      <ol className="chat-response-steps__list" hidden>
        {responseSteps.steps.map(step => (
          <li className={`chat-response-steps__item is-${step.status}`} key={step.id}>
            <span className="chat-response-steps__status" aria-hidden="true" />
            <span className="chat-response-steps__title">{step.title}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
