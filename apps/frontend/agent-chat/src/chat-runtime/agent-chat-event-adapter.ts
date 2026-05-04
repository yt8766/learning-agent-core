import type { AgentChatRuntimeEvent, AgentFrontendChatMessage } from './agent-chat-types';

export function foldAgentChatRuntimeEvent(input: {
  currentMessage: AgentFrontendChatMessage;
  event: AgentChatRuntimeEvent;
}): AgentFrontendChatMessage {
  return {
    ...input.currentMessage,
    meta: {
      ...input.currentMessage.meta,
      think: input.event.thinkState,
      thoughtChain: input.event.thoughtChain ?? [],
      responseSteps: input.event.responseSteps ?? []
    }
  };
}
