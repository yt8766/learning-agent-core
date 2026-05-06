export type MergeableChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export function mergeSystemMessages<TMessage extends MergeableChatMessage>(messages: TMessage[]): TMessage[] {
  const systemMessages = messages.filter(message => message.role === 'system');
  if (systemMessages.length <= 1) {
    return messages;
  }

  const mergedSystemContent = systemMessages.map(message => message.content).join('\n\n');
  let emittedMergedSystem = false;

  return messages.flatMap(message => {
    if (message.role !== 'system') {
      return [message];
    }

    if (emittedMergedSystem) {
      return [];
    }

    emittedMergedSystem = true;
    return [
      {
        ...message,
        content: mergedSystemContent
      }
    ];
  });
}
