export class LangChainChatProvider {}

export function createChatOpenAIProvider() {
  return new LangChainChatProvider();
}
