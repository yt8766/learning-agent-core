import { QuickResponseSteps, ResponseStepSummary } from '@/components/chat-response-steps';
import type { ChatResponseStepsForMessage } from '@/lib/chat-response-step-projections';

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

  if (responseSteps.status === 'completed') {
    return <ResponseStepSummary responseSteps={responseSteps} />;
  }

  return <QuickResponseSteps responseSteps={responseSteps} />;
}
