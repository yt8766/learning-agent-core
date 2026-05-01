import { describe, expect, it } from 'vitest';

import { buildRuntimeWorkspaceTaskProjection } from '../../../src/runtime/centers/runtime-centers-workspace-projection';

describe('runtime-centers workspace task projection', () => {
  it('selects a running task as current task while keeping recent task projections ordered by time', () => {
    const projection = buildRuntimeWorkspaceTaskProjection(
      [
        {
          id: 'task-completed-newer',
          goal: 'Completed newer task',
          status: 'completed',
          updatedAt: '2026-04-26T12:00:00.000Z'
        },
        {
          id: 'task-running',
          goal: 'Running task',
          status: 'running',
          executionMode: 'execute',
          activeInterrupt: { interactionKind: 'approval' },
          updatedAt: '2026-04-26T11:00:00.000Z'
        },
        {
          id: 'task-without-time',
          goal: 'Task without time',
          status: 'completed'
        }
      ],
      []
    );

    expect(projection.currentTask).toEqual({
      taskId: 'task-running',
      title: 'Running task',
      status: 'running',
      executionMode: 'execute',
      interactionKind: 'approval'
    });
  });

  it('projects evidence as a safe allowlisted summary with duplicate ids overwritten and capped', () => {
    const projection = buildRuntimeWorkspaceTaskProjection(
      [
        {
          id: 'task-evidence',
          status: 'completed',
          updatedAt: '2026-04-26T12:00:00.000Z',
          externalSources: [
            {
              id: 'freshness-meta',
              sourceType: 'freshness_meta',
              summary: 'Freshness metadata must not become workspace evidence'
            },
            {
              id: 'web-search-result',
              sourceType: 'web_search_result',
              sourceUrl: 'search://raw-result',
              summary: 'Raw search result must not become workspace evidence'
            },
            {
              id: 'research-plan',
              sourceType: 'web_research_plan',
              sourceUrl: 'plan://raw-plan',
              summary: 'Raw research plan must not become workspace evidence'
            },
            {
              id: 'evidence-1',
              sourceType: 'docs',
              sourceUrl: 'docs://old',
              summary: 'Old summary',
              rawMetadata: { secret: 'must not leak' }
            } as any,
            {
              id: 'evidence-1',
              sourceType: 'workspace-docs',
              sourceUrl: 'docs://new',
              summary: 'New summary',
              rawMetadata: { secret: 'must not leak' }
            } as any,
            ...Array.from({ length: 9 }, (_, index) => ({
              id: `evidence-extra-${index}`,
              sourceType: 'workspace-docs',
              sourceUrl: `docs://extra/${index}`,
              summary: `Extra ${index}`,
              rawMetadata: { secret: `extra-${index}` }
            }))
          ]
        }
      ],
      []
    );

    expect(projection.evidence).toHaveLength(8);
    expect(projection.evidence[0]).toEqual({
      evidenceId: 'evidence-1',
      title: 'docs://new',
      summary: 'New summary',
      sourceKind: 'workspace-docs',
      citationId: 'docs://new'
    });
    expect(JSON.stringify(projection.evidence)).not.toContain('must not leak');
    expect(projection.evidence.map(item => item.evidenceId)).not.toEqual(
      expect.arrayContaining(['freshness-meta', 'web-search-result', 'research-plan'])
    );
  });

  it('dedupes skill reuse badges across persisted records and task skill references', () => {
    const projection = buildRuntimeWorkspaceTaskProjection(
      [
        {
          id: 'task-reuse',
          status: 'completed',
          reusedMemories: ['memory-1'],
          reusedRules: ['rule-1'],
          reusedSkills: ['skill-1'],
          usedInstalledSkills: ['installed-skill:skill-1']
        }
      ],
      [],
      [
        {
          id: 'reuse-1',
          workspaceId: 'workspace-platform',
          skillId: 'skill-1',
          reusedBy: { id: 'agent-1', label: 'Agent 1', kind: 'agent' },
          taskId: 'task-reuse',
          outcome: 'succeeded',
          reusedAt: '2026-04-26T11:00:00.000Z'
        }
      ]
    );

    expect(projection.reuseBadges).toEqual([
      { kind: 'skill', id: 'skill-1', label: 'skill-1' },
      { kind: 'memory', id: 'memory-1', label: 'memory-1' },
      { kind: 'rule', id: 'rule-1', label: 'rule-1' }
    ]);
  });

  it('uses learning summary fallback order and maps task outcomes', () => {
    const projection = buildRuntimeWorkspaceTaskProjection(
      [
        {
          id: 'task-rationale',
          status: 'completed',
          sessionId: 'session-1',
          learningEvaluation: { rationale: 'Rationale summary', notes: ['Note summary'] },
          updatedAt: '2026-04-26T12:00:00.000Z'
        },
        {
          id: 'task-note',
          status: 'failed',
          learningEvaluation: { notes: ['Note fallback'] },
          updatedAt: '2026-04-26T11:00:00.000Z'
        },
        {
          id: 'task-result',
          status: 'cancelled',
          result: 'Result fallback',
          reusedMemories: ['memory-result'],
          updatedAt: '2026-04-26T10:00:00.000Z'
        },
        {
          id: 'task-goal',
          status: 'running',
          goal: 'Goal fallback',
          reusedRules: ['rule-goal'],
          updatedAt: '2026-04-26T09:00:00.000Z'
        }
      ],
      [
        {
          draftId: 'draft-1',
          status: 'draft',
          title: 'Draft',
          summary: 'Draft',
          sourceTaskId: 'task-rationale',
          createdAt: '2026-04-26T00:00:00.000Z',
          updatedAt: '2026-04-26T00:00:00.000Z'
        }
      ] as any
    );

    expect(
      projection.learningSummaries.map(summary => ({
        taskId: summary.taskId,
        summary: summary.summary,
        outcome: summary.outcome,
        skillDraftRefs: summary.skillDraftRefs
      }))
    ).toEqual([
      {
        taskId: 'task-rationale',
        summary: 'Rationale summary',
        outcome: 'succeeded',
        skillDraftRefs: [{ draftId: 'draft-1', status: 'draft' }]
      },
      {
        taskId: 'task-note',
        summary: 'Note fallback',
        outcome: 'failed',
        skillDraftRefs: []
      },
      {
        taskId: 'task-result',
        summary: 'Result fallback',
        outcome: 'canceled',
        skillDraftRefs: []
      },
      {
        taskId: 'task-goal',
        summary: 'Goal fallback',
        outcome: 'partial',
        skillDraftRefs: []
      }
    ]);
  });

  it('projects learning summary evidence, reuse hints, skill draft refs and capability gaps', () => {
    const projection = buildRuntimeWorkspaceTaskProjection(
      [
        {
          id: 'task-workspace-1',
          goal: 'Stabilize workspace flywheel',
          status: 'completed',
          sessionId: 'session-workspace-1',
          result: 'Workspace flywheel stabilized.',
          externalSources: [
            {
              id: 'evidence-workspace-1',
              sourceType: 'workspace-docs',
              sourceUrl: 'docs://workspace',
              trustClass: 'internal',
              summary: 'Workspace docs captured the implementation boundary.'
            }
          ],
          reusedMemories: ['memory-1'],
          reusedRules: ['rule-1'],
          reusedSkills: ['skill-1'],
          learningEvaluation: {
            rationale: '任务完成后可沉淀 workspace flywheel 经验。'
          },
          skillSearch: {
            capabilityGapDetected: true,
            query: 'workspace-vault',
            gapSummary: '需要补齐 workspace vault 聚合。'
          }
        }
      ],
      [
        {
          draftId: 'draft-workspace-1',
          status: 'draft',
          title: 'Workspace projection draft',
          summary: 'Workspace projection draft',
          sourceTaskId: 'task-workspace-1',
          createdAt: '2026-04-26T00:00:00.000Z',
          updatedAt: '2026-04-26T00:00:00.000Z'
        }
      ] as any
    );

    expect(projection.learningSummaries[0]).toMatchObject({
      taskId: 'task-workspace-1',
      sessionId: 'session-workspace-1',
      summary: '任务完成后可沉淀 workspace flywheel 经验。',
      outcome: 'succeeded',
      evidenceRefs: [
        {
          evidenceId: 'evidence-workspace-1',
          title: 'Workspace docs captured the implementation boundary.',
          sourceKind: 'workspace-docs'
        }
      ],
      memoryHints: [{ id: 'memory-1', summary: 'memory-1' }],
      ruleHints: [{ id: 'rule-1', summary: 'rule-1' }],
      skillDraftRefs: [{ draftId: 'draft-workspace-1', status: 'draft' }],
      capabilityGaps: [
        {
          capabilityId: 'workspace-vault',
          label: '需要补齐 workspace vault 聚合。'
        }
      ]
    });
  });

  it('falls back capability gap labels and suggested actions from skill search metadata', () => {
    const projection = buildRuntimeWorkspaceTaskProjection(
      [
        {
          id: 'task-gap-summary',
          status: 'completed',
          skillSearch: {
            capabilityGapDetected: true,
            query: 'workspace-vault',
            gapSummary: 'Explicit gap summary'
          }
        },
        {
          id: 'task-gap-mcp',
          status: 'completed',
          skillSearch: {
            capabilityGapDetected: true,
            query: 'mcp-gap',
            mcpRecommendation: { summary: 'MCP recommendation summary' }
          }
        },
        {
          id: 'task-gap-suggestion',
          status: 'completed',
          skillSearch: {
            capabilityGapDetected: true,
            query: 'suggestion-gap',
            suggestions: [{ displayName: 'Suggestion display', summary: 'Install suggestion' }]
          }
        },
        {
          id: 'task-gap-default',
          status: 'completed',
          skillSearch: {
            capabilityGapDetected: true,
            query: 'default-gap'
          }
        }
      ],
      []
    );

    expect(projection.capabilityGaps).toEqual([
      {
        capabilityId: 'workspace-vault',
        label: 'Explicit gap summary',
        severity: 'medium'
      },
      {
        capabilityId: 'mcp-gap',
        label: 'MCP recommendation summary',
        severity: 'medium'
      },
      {
        capabilityId: 'suggestion-gap',
        label: 'Suggestion display',
        severity: 'medium',
        suggestedAction: 'Install suggestion'
      },
      {
        capabilityId: 'default-gap',
        label: 'Capability gap detected',
        severity: 'medium'
      }
    ]);
  });
});
