import { describe, expect, it } from 'vitest';

import {
  ChatEventRecordSchema,
  EvidenceRecordSchema,
  LearningCandidateRecordSchema,
  LearningConfirmationDtoSchema,
  MemoryRecordSchema
} from '@agent/core';
import { createLearningGraph } from '@agent/runtime';

describe('learning confirmation integration', () => {
  it('auto-confirms high-confidence controlled-source candidates through the learning graph', async () => {
    const candidate = LearningCandidateRecordSchema.parse({
      id: 'candidate-memory-1',
      taskId: 'task-learning-1',
      type: 'memory',
      summary: 'Prefer schema-first contracts for stable DTOs.',
      status: 'pending_confirmation',
      payload: { memoryId: 'memory-1' },
      confidenceScore: 0.94,
      provenance: [{ source: 'controlled-doc', uri: 'docs/evals/verification-system-guidelines.md' }],
      autoConfirmEligible: true,
      createdAt: '2026-04-23T00:00:00.000Z'
    });
    const graph = createLearningGraph({
      async confirm(state) {
        return {
          ...state,
          autoConfirmed: true,
          confirmedCandidates: [
            {
              ...candidate,
              status: 'confirmed',
              confirmedAt: '2026-04-23T00:00:01.000Z'
            }
          ]
        };
      }
    }).compile();

    const result = await graph.invoke({
      taskId: 'task-learning-1',
      candidateIds: ['candidate-memory-1'],
      autoConfirmed: false,
      confirmedCandidates: []
    });

    expect(result.autoConfirmed).toBe(true);
    expect(result.confirmedCandidates).toHaveLength(1);
    expect(result.confirmedCandidates[0]).toMatchObject({
      id: 'candidate-memory-1',
      status: 'confirmed',
      confidenceScore: 0.94,
      autoConfirmEligible: true
    });
  });

  it('keeps learning confirmation events, memory records, and evidence records parseable together', () => {
    const confirmation = LearningConfirmationDtoSchema.parse({
      sessionId: 'session-learning-1',
      actor: 'human',
      candidateIds: ['candidate-memory-1']
    });
    const event = ChatEventRecordSchema.parse({
      id: 'evt-learning-confirmed',
      sessionId: confirmation.sessionId,
      type: 'learning_confirmed',
      at: '2026-04-23T00:00:02.000Z',
      payload: {
        actor: confirmation.actor,
        candidateIds: confirmation.candidateIds,
        memoryIds: ['memory-1']
      }
    });
    const memory = MemoryRecordSchema.parse({
      id: 'memory-1',
      type: 'learning',
      summary: 'Prefer schema-first contracts for stable DTOs.',
      content: 'Stable DTO/event/payload contracts should define zod schemas before public types.',
      source: 'learning-confirmation',
      confidence: 0.94,
      status: 'active',
      createdAt: '2026-04-23T00:00:03.000Z'
    });
    const evidence = EvidenceRecordSchema.parse({
      id: 'evidence-learning-1',
      taskId: 'task-learning-1',
      sourceType: 'controlled-doc',
      sourceUrl: 'docs/evals/verification-system-guidelines.md',
      trustClass: 'controlled',
      summary: 'Verification guidelines require schema-first stable contracts.',
      createdAt: '2026-04-23T00:00:04.000Z'
    });

    expect(event.payload.candidateIds).toEqual(['candidate-memory-1']);
    expect(memory.confidence).toBeGreaterThanOrEqual(0.9);
    expect(evidence.trustClass).toBe('controlled');
  });
});
