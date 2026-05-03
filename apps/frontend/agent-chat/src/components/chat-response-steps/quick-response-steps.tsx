import type { ChatResponseStepsForMessage } from '@/utils/chat-response-step-projections';

import { AgentOsRunPanel } from './agent-os-run-panel';

import { AgentOsRunPanel } from './agent-os-run-panel';

type QuickResponseStepsProps = {
  responseSteps: ChatResponseStepsForMessage;
};

export function QuickResponseSteps({ responseSteps }: QuickResponseStepsProps) {
  return <AgentOsRunPanel responseSteps={responseSteps} defaultOpen />;
}
