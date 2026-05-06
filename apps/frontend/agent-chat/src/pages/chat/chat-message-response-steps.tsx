import { QuickResponseSteps, ResponseStepSummary } from '@/components/chat-response-steps';
import type { ChatResponseStepsForMessage } from '@/utils/chat-response-step-projections';
import { cn } from '@/utils/cn';

type RenderMessageResponseStepsOptions = {
  responseSteps?: ChatResponseStepsForMessage;
  placement: 'before-content' | 'after-content';
  /** DeepSeek-style cognition log already covers retrieval; hide duplicate node-telemetry strip. */
  suppressForNarrativeCognition?: boolean;
};

export function renderMessageResponseSteps({
  responseSteps,
  placement,
  suppressForNarrativeCognition
}: RenderMessageResponseStepsOptions) {
  if (suppressForNarrativeCognition) {
    return null;
  }
  if (!responseSteps || responseSteps.displayMode === 'answer_only') {
    return null;
  }

  if (placement !== 'before-content') {
    return null;
  }

  const panelClass = cn(
    'rounded-xl border border-indigo-100/85 bg-chat-elevated/95 p-3 shadow-[0_6px_24px_rgba(79,70,229,0.07)] backdrop-blur-sm motion-reduce:backdrop-blur-none'
  );

  if (responseSteps.status === 'completed') {
    return (
      <div className={panelClass}>
        <ResponseStepSummary responseSteps={responseSteps} />
      </div>
    );
  }

  return (
    <div className={panelClass}>
      <QuickResponseSteps responseSteps={responseSteps} />
    </div>
  );
}
