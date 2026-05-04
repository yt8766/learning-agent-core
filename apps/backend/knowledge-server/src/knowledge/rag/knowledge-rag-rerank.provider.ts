import type {
  RetrievalHit,
  RetrievalRerankInput,
  RetrievalRerankProvider,
  RetrievalRerankScore
} from '@agent/knowledge';

const MAX_RERANK_HITS = 10;

interface KnowledgeRagRerankProviderOptions {
  generate(input: {
    model: string;
    messages: Array<{ role: 'system' | 'user'; content: string }>;
  }): Promise<{ text: string }>;
  modelId: string;
}

export function createKnowledgeRagRerankProvider(options: KnowledgeRagRerankProviderOptions): RetrievalRerankProvider {
  return {
    async rerank(input: RetrievalRerankInput): Promise<RetrievalRerankScore[]> {
      const topHits = input.hits.slice(0, MAX_RERANK_HITS);
      if (topHits.length === 0) {
        return [];
      }

      try {
        const generated = await options.generate({
          model: options.modelId,
          messages: [
            {
              role: 'system',
              content: buildRerankSystemPrompt()
            },
            {
              role: 'user',
              content: buildRerankUserPrompt(input.query, topHits)
            }
          ]
        });

        const scores = parseRerankScores(generated.text, topHits);
        return input.hits.map(hit => {
          const matched = scores.find(score => score.chunkId === hit.chunkId);
          return matched ?? { chunkId: hit.chunkId, alignmentScore: 0.5 };
        });
      } catch {
        // Rerank failure is non-critical; return neutral scores so deterministic ranking remains.
        return input.hits.map(hit => ({ chunkId: hit.chunkId, alignmentScore: 0.5 }));
      }
    }
  };
}

function buildRerankSystemPrompt(): string {
  return [
    'You are a semantic relevance evaluator for a knowledge retrieval system.',
    'Given a user query and a list of document chunks, evaluate how semantically relevant each chunk is to answering the query.',
    'Rate each chunk with an alignmentScore from 0.0 (completely irrelevant) to 1.0 (perfectly relevant).',
    'Return ONLY a JSON array in this exact format with no markdown, prose, comments, or code fences:',
    '[',
    '  { "chunkId": "<id>", "alignmentScore": 0.85 },',
    '  ...',
    ']'
  ].join('\n');
}

function buildRerankUserPrompt(query: string, hits: RetrievalHit[]): string {
  const chunks = hits
    .map((hit, index) => `[${index + 1}] chunkId: ${hit.chunkId}\nContent: ${hit.content.trim()}`)
    .join('\n\n');

  return [`Query: ${query}`, '', 'Chunks:', chunks, '', 'Return the JSON array of relevance scores:'].join('\n');
}

function parseRerankScores(text: string, hits: RetrievalHit[]): RetrievalRerankScore[] {
  const trimmed = text.trim();
  let parsed: unknown;

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    parsed = JSON.parse(trimmed);
  } else {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      parsed = JSON.parse(fenced[1]);
    } else {
      const start = trimmed.indexOf('[');
      const end = trimmed.lastIndexOf(']');
      if (start >= 0 && end > start) {
        parsed = JSON.parse(trimmed.slice(start, end + 1));
      } else {
        throw new Error('Rerank provider did not return a JSON array.');
      }
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Rerank provider did not return a JSON array.');
  }

  const validChunkIds = new Set(hits.map(hit => hit.chunkId));
  const scores: RetrievalRerankScore[] = [];

  for (const item of parsed) {
    if (
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).chunkId === 'string' &&
      typeof (item as Record<string, unknown>).alignmentScore === 'number' &&
      validChunkIds.has((item as Record<string, unknown>).chunkId as string)
    ) {
      scores.push({
        chunkId: (item as Record<string, unknown>).chunkId as string,
        alignmentScore: Math.max(0, Math.min(1, (item as Record<string, unknown>).alignmentScore as number))
      });
    }
  }

  return scores;
}
