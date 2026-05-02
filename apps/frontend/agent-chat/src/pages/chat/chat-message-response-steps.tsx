import { QuickResponseSteps, ResponseStepSummary } from '@/components/chat-response-steps';
import type { ChatResponseStepsForMessage } from '@/lib/chat-response-step-projections';

type RenderMessageResponseStepsOptions = {
  responseSteps?: ChatResponseStepsForMessage;
  placement: 'before-content' | 'after-content';
};

export function renderMessageResponseSteps({ responseSteps, placement }: RenderMessageResponseStepsOptions) {
  if (!responseSteps) {
    return null;
  }

  if (placement === 'before-content' && responseSteps.status !== 'completed') {
    return <QuickResponseSteps responseSteps={responseSteps} />;
  }

  if (placement === 'after-content' && responseSteps.status === 'completed') {
    return <ResponseStepSummary responseSteps={responseSteps} />;
  }

  return null;
}
