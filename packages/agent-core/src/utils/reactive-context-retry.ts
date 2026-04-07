import type { ChatMessage } from '../adapters/llm/llm-provider';
import type { AgentRuntimeContext } from '../runtime/agent-runtime-context';

import { applyReactiveCompactRetry, buildContextCompressionResult } from './context-compression-pipeline';

const CONTEXT_OVERFLOW_PATTERN =
  /(maximum context length|context length|context window|token limit|too many tokens|prompt is too long|context overflow)/i;

export function isLikelyContextOverflow(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return CONTEXT_OVERFLOW_PATTERN.test(message);
}

export function buildCompactedMessages(messages: ChatMessage[], summary: string): ChatMessage[] {
  const systemMessages = messages.filter(message => message.role === 'system').slice(0, 1);
  const trailingMessages = messages
    .filter(message => message.role !== 'system')
    .slice(-2)
    .map(message => ({
      ...message,
      content: message.content.length > 240 ? `${message.content.slice(0, 237)}...` : message.content
    }));

  return [
    ...systemMessages,
    {
      role: 'system',
      content: `Earlier context compacted for retry:\n${summary}`
    },
    ...trailingMessages
  ];
}

export async function withReactiveContextRetry<T>(params: {
  context: AgentRuntimeContext;
  trigger: string;
  messages: ChatMessage[];
  invoke: (messages: ChatMessage[]) => Promise<T>;
}) {
  try {
    return await params.invoke(params.messages);
  } catch (error) {
    if (!isLikelyContextOverflow(error)) {
      throw error;
    }

    const compacted = applyReactiveCompactRetry(
      buildContextCompressionResult({
        goal: params.context.goal,
        context: params.messages.map(message => `${message.role}: ${message.content}`).join('\n'),
        planDraft: undefined,
        plan: undefined,
        trace: []
      }),
      params.trigger,
      '上下文已压缩重试。'
    );
    await params.context.onContextCompaction?.({
      trigger: params.trigger,
      result: compacted
    });
    return params.invoke(buildCompactedMessages(params.messages, compacted.summary));
  }
}
