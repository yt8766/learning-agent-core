import type { ChatResponseStepsForMessage } from '@/utils/chat-response-step-projections';

import { AgentOsRunPanel } from './agent-os-run-panel';
export { buildResponseStepSummaryTitle } from './agent-os-run-panel';

type ResponseStepSummaryProps = {
  responseSteps: ChatResponseStepsForMessage;
};

export function ResponseStepSummary({ responseSteps }: ResponseStepSummaryProps) {
  return <AgentOsRunPanel responseSteps={responseSteps} defaultOpen={false} />;
}
