import type { Citation } from '@agent/knowledge';

interface HallucinationDetectorOptions {
  generate(input: {
    model: string;
    messages: Array<{ role: 'system' | 'user'; content: string }>;
  }): Promise<{ text: string }>;
  modelId: string;
}

export interface HallucinationCheckResult {
  hallucinationScore: number;
  flagged: boolean;
  reasoning?: string;
}

export interface HallucinationDetector {
  detect(input: { answer: string; citations: Citation[] }): Promise<HallucinationCheckResult>;
}

export function createKnowledgeRagHallucinationDetector(options: HallucinationDetectorOptions): HallucinationDetector {
  return {
    async detect(input: { answer: string; citations: Citation[] }): Promise<HallucinationCheckResult> {
      if (input.citations.length === 0) {
        return { hallucinationScore: 0, flagged: false };
      }

      try {
        const generated = await options.generate({
          model: options.modelId,
          messages: [
            {
              role: 'system',
              content: buildHallucinationSystemPrompt()
            },
            {
              role: 'user',
              content: buildHallucinationUserPrompt(input.answer, input.citations)
            }
          ]
        });

        return parseHallucinationResult(generated.text);
      } catch {
        // Detection failure is non-critical; return neutral result.
        return { hallucinationScore: 0, flagged: false };
      }
    }
  };
}

function buildHallucinationSystemPrompt(): string {
  return [
    'You are a fact-checking assistant for a knowledge retrieval system.',
    'Given an AI-generated answer and a list of source citations, determine whether the answer contains any hallucinations.',
    'A hallucination is any claim, fact, or detail in the answer that is not supported by the provided citations.',
    'Rate the hallucination risk from 0.0 (fully grounded in citations) to 1.0 (completely hallucinated).',
    'Return ONLY a JSON object in this exact format with no markdown, prose, comments, or code fences:',
    '{',
    '  "hallucinationScore": 0.0,',
    '  "flagged": false,',
    '  "reasoning": "short explanation"',
    '}'
  ].join('\n');
}

function buildHallucinationUserPrompt(answer: string, citations: Citation[]): string {
  const context = citations
    .map((citation, index) => `[${index + 1}] ${citation.title}\n${citation.quote ?? ''}`.trim())
    .join('\n\n');

  return [
    'Source citations:\n',
    context,
    '',
    'AI-generated answer:\n',
    answer.trim(),
    '',
    'Return the JSON object with hallucination assessment:'
  ].join('\n');
}

function parseHallucinationResult(text: string): HallucinationCheckResult {
  const trimmed = text.trim();
  let parsed: unknown;

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    parsed = JSON.parse(trimmed);
  } else {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      parsed = JSON.parse(fenced[1]);
    } else {
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start >= 0 && end > start) {
        parsed = JSON.parse(trimmed.slice(start, end + 1));
      } else {
        throw new Error('Hallucination detector did not return JSON.');
      }
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Hallucination detector did not return a JSON object.');
  }

  const record = parsed as Record<string, unknown>;
  const score = typeof record.hallucinationScore === 'number' ? Math.max(0, Math.min(1, record.hallucinationScore)) : 0;
  const flagged = typeof record.flagged === 'boolean' ? record.flagged : score > 0.5;
  const reasoning = typeof record.reasoning === 'string' ? record.reasoning : undefined;

  return { hallucinationScore: score, flagged, reasoning };
}
