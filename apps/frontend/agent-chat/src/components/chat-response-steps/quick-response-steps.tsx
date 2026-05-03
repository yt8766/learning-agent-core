import type { ChatResponseStepsForMessage } from '@/lib/chat-response-step-projections';

import { AgentOsRunPanel } from './agent-os-run-panel';

type QuickResponseStepsProps = {
  responseSteps: ChatResponseStepsForMessage;
};

export function QuickResponseSteps({ responseSteps }: QuickResponseStepsProps) {
  return <AgentOsRunPanel responseSteps={responseSteps} defaultOpen />;
}
