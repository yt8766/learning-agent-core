import { describe, expect, it } from 'vitest';

import { buildResearchSourcePlan } from '../../src/workflows/research-source-planner';

// Legacy aliases remain valid inputs here; the planner still normalizes them through executionPlan.mode semantics.
describe('research-source-planner execution mode guard', () => {
  it('downgrades planning-readonly source planning to internal-only', () => {
    const sources = buildResearchSourcePlan({
      taskId: 'task-1',
      goal: '帮我调研最新的 OpenAI 和 LangGraph 变化',
      executionMode: 'planning-readonly',
      workflow: {
        id: 'workflow',
        displayName: 'Workflow',
        intentPatterns: [],
        requiredMinistries: ['libu-router', 'hubu-search'],
        allowedCapabilities: ['webSearchPrime', 'webReader', 'search_doc'],
        approvalPolicy: 'high-risk-only',
        webLearningPolicy: {
          enabled: true,
          preferredSourceTypes: ['docs', 'web'],
          acceptedTrustClasses: ['official']
        },
        sourcePolicy: {
          mode: 'open-web-allowed',
          preferredUrls: ['https://internal.example.com/architecture']
        },
        outputContract: {
          type: 'summary',
          requiredSections: ['summary']
        }
      }
    });

    expect(sources).toEqual([
      expect.objectContaining({
        sourceUrl: 'https://internal.example.com/architecture'
      })
    ]);
    expect(sources).toHaveLength(1);
  });

  it('still emits open-web research sources in standard mode', () => {
    const sources = buildResearchSourcePlan({
      taskId: 'task-1',
      goal: '帮我调研最新的 OpenAI 和 LangGraph 变化',
      executionMode: 'standard',
      workflow: {
        id: 'workflow',
        displayName: 'Workflow',
        intentPatterns: [],
        requiredMinistries: ['libu-router', 'hubu-search'],
        allowedCapabilities: ['webSearchPrime', 'webReader', 'search_doc'],
        approvalPolicy: 'high-risk-only',
        webLearningPolicy: {
          enabled: true,
          preferredSourceTypes: ['docs', 'web'],
          acceptedTrustClasses: ['official']
        },
        sourcePolicy: {
          mode: 'open-web-allowed',
          preferredUrls: ['https://internal.example.com/architecture']
        },
        outputContract: {
          type: 'summary',
          requiredSections: ['summary']
        }
      }
    });

    expect(sources.length).toBeGreaterThan(1);
    expect(sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceUrl: 'https://platform.openai.com/docs' }),
        expect.objectContaining({ sourceUrl: 'https://langchain-ai.github.io/langgraph/' })
      ])
    );
  });
});
