import type { AgentChatRuntimeEvent, AgentFrontendChatMessage } from './agent-chat-types';

export function foldAgentChatRuntimeEvent(input: {
  currentMessage: AgentFrontendChatMessage;
  event: AgentChatRuntimeEvent;
}): AgentFrontendChatMessage {
  const currentMeta = input.currentMessage.meta;

  return {
    ...input.currentMessage,
    meta: {
      ...currentMeta,
      think: input.event.thinkState ?? currentMeta?.think,
      thoughtChain: input.event.thoughtChain ?? currentMeta?.thoughtChain,
      responseSteps: input.event.responseSteps ?? currentMeta?.responseSteps
    }
  };
}
