interface KnowledgeHydeProviderOptions {
  generate(input: {
    model: string;
    messages: Array<{ role: 'system' | 'user'; content: string }>;
  }): Promise<{ text: string }>;
  modelId: string;
}

export interface HyDeProvider {
  generateHypotheticalAnswer(query: string): Promise<string>;
}

export function createKnowledgeHydeProvider(options: KnowledgeHydeProviderOptions): HyDeProvider {
  return {
    async generateHypotheticalAnswer(query: string): Promise<string> {
      const generated = await options.generate({
        model: options.modelId,
        messages: [
          {
            role: 'system',
            content: buildHydeSystemPrompt()
          },
          {
            role: 'user',
            content: buildHydeUserPrompt(query)
          }
        ]
      });

      return generated.text.trim();
    }
  };
}

function buildHydeSystemPrompt(): string {
  return [
    'You are a knowledge base query expansion assistant.',
    'Given a user query, generate a concise hypothetical document (1-2 paragraphs) that would be the ideal answer to this query.',
    'This hypothetical document will be used for semantic retrieval, so it should contain relevant concepts, terminology, and context that would match real documents in the knowledge base.',
    'Return ONLY the hypothetical document text, with no markdown, explanation, or comments.'
  ].join('\n');
}

function buildHydeUserPrompt(query: string): string {
  return `User query: ${query}\n\nHypothetical answer:`;
}
