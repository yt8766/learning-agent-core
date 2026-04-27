import { describe, expect, it } from 'vitest';
import { buildRuntimeWorkspaceCenter } from '../src/centers/runtime-workspace-center';

describe('runtime-workspace-center', () => {
  it('builds a whitelisted Agent Workspace MVP projection with skill draft status counts', () => {
    const result = buildRuntimeWorkspaceCenter({
      workspace: {
        workspaceId: 'workspace-1',
        sessionId: 'session-1',
        taskId: 'task-1',
        status: 'running',
        generatedAt: '2026-04-26T00:00:00.000Z',
        updatedAt: '2026-04-26T00:03:00.000Z',
        metadata: { providerRaw: 'must-not-leak' },
        rawMetadata: { credential: 'secret' },
        currentTask: {
          taskId: 'task-1',
          title: 'Build workspace projection',
          status: 'running',
          executionMode: 'execute',
          interactionKind: 'approval',
          metadata: { prompt: 'must-not-leak' }
        },
        evidence: [
          {
            evidenceId: 'evidence-1',
            title: 'API contract',
            summary: 'Workspace projection contract',
            sourceKind: 'docs',
            citationId: 'agent-workspace.md',
            rawMetadata: { url: 'internal' }
          }
        ],
        reuseBadges: [
          {
            kind: 'skill',
            id: 'skill-1',
            label: 'Workspace Builder',
            confidence: 0.91,
            metadata: { internalScore: 99 }
          }
        ],
        capabilityGaps: [
          {
            capabilityId: 'gap-1',
            label: 'Projection persistence',
            severity: 'medium',
            suggestedAction: 'Keep MVP pure for now',
            internalMetadata: { owner: 'runtime' }
          }
        ]
      },
      skillDrafts: [
        {
          draftId: 'draft-1',
          status: 'draft',
          title: 'Draft skill',
          summary: 'Candidate skill needs review',
          sourceTaskId: 'task-1',
          sessionId: 'session-1',
          confidence: 0.72,
          riskLevel: 'medium',
          createdAt: '2026-04-26T00:01:00.000Z',
          updatedAt: '2026-04-26T00:02:00.000Z',
          install: {
            receiptId: 'receipt-1',
            skillId: 'workspace-draft-draft-1',
            sourceId: 'workspace-skill-drafts',
            version: '20260426000300',
            status: 'installed',
            phase: 'installed',
            installedAt: '2026-04-26T00:03:00.000Z',
            rawMetadata: { stack: 'must-not-leak' }
          },
          provenance: {
            sourceKind: 'workspace-draft',
            sourceTaskId: 'task-1',
            sourceEvidenceIds: ['evidence-1'],
            evidenceCount: 1,
            evidenceRefs: [
              {
                evidenceId: 'evidence-1',
                title: 'API contract',
                summary: 'Workspace projection contract',
                sourceKind: 'docs',
                citationId: 'agent-workspace.md'
              }
            ],
            manifestId: 'workspace-draft-draft-1',
            manifestSourceId: 'workspace-skill-drafts',
            rawMetadata: { provider: 'must-not-leak' },
            failureDetail: 'must-not-leak'
          },
          lifecycle: {
            draftStatus: 'draft',
            installStatus: 'installed',
            reusable: true,
            nextAction: 'ready_to_reuse',
            rawMetadata: { detail: 'must-not-leak' }
          },
          metadata: { toolRawOutput: 'must-not-leak' }
        },
        {
          draftId: 'draft-2',
          status: 'active',
          title: 'Active skill',
          summary: 'Skill is active',
          createdAt: '2026-04-25T00:01:00.000Z',
          updatedAt: '2026-04-25T00:02:00.000Z',
          decidedAt: '2026-04-25T00:03:00.000Z',
          decidedBy: 'reviewer-1',
          rawMetadata: { modelResponse: 'must-not-leak' }
        },
        {
          draftId: 'draft-3',
          status: 'trusted',
          title: 'Trusted skill',
          summary: 'Skill is trusted',
          createdAt: '2026-04-24T00:01:00.000Z',
          updatedAt: '2026-04-24T00:02:00.000Z'
        },
        {
          draftId: 'draft-4',
          status: 'rejected',
          title: 'Rejected skill',
          summary: 'Skill was rejected',
          createdAt: '2026-04-23T00:01:00.000Z',
          updatedAt: '2026-04-23T00:02:00.000Z'
        },
        {
          draftId: 'draft-5',
          status: 'retired',
          title: 'Retired skill',
          summary: 'Skill was retired',
          createdAt: '2026-04-22T00:01:00.000Z',
          updatedAt: '2026-04-22T00:02:00.000Z'
        },
        {
          draftId: 'draft-6',
          status: 'shadow',
          title: 'Shadow skill',
          summary: 'Skill is in shadow mode',
          createdAt: '2026-04-21T00:01:00.000Z',
          updatedAt: '2026-04-21T00:02:00.000Z'
        }
      ],
      reuseRecords: [
        {
          id: 'reuse-1',
          workspaceId: 'workspace-1',
          skillId: 'skill-1',
          reusedBy: {
            id: 'agent-supervisor',
            label: 'Supervisor',
            kind: 'agent'
          },
          taskId: 'task-1',
          outcome: 'succeeded',
          evidenceRefs: ['evidence-1'],
          reusedAt: '2026-04-26T00:05:00.000Z',
          rawMetadata: { prompt: 'must-not-leak' }
        } as any
      ],
      learningSummaries: [
        {
          taskId: 'task-1',
          sessionId: 'session-1',
          generatedAt: '2026-04-26T00:04:00.000Z',
          summary: 'Projection should remain whitelisted.',
          outcome: 'succeeded',
          evidenceRefs: [
            {
              evidenceId: 'evidence-1',
              title: 'API contract',
              sourceKind: 'docs',
              metadata: { internal: true }
            }
          ],
          memoryHints: [
            {
              id: 'memory-1',
              summary: 'Use API projection fields only.',
              confidence: 0.8,
              metadata: { internal: true }
            }
          ],
          ruleHints: [
            {
              id: 'rule-1',
              summary: 'Do not leak raw metadata.',
              confidence: 0.9,
              rawMetadata: { internal: true }
            }
          ],
          skillDraftRefs: [
            {
              draftId: 'draft-1',
              status: 'draft',
              metadata: { internal: true }
            }
          ],
          capabilityGaps: [
            {
              capabilityId: 'gap-1',
              label: 'Projection persistence',
              severity: 'medium',
              internalMetadata: { internal: true }
            }
          ],
          metadata: { providerRaw: 'must-not-leak' }
        }
      ]
    });

    expect(result).toEqual({
      workspaceId: 'workspace-1',
      sessionId: 'session-1',
      taskId: 'task-1',
      status: 'running',
      generatedAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:03:00.000Z',
      currentTask: {
        taskId: 'task-1',
        title: 'Build workspace projection',
        status: 'running',
        executionMode: 'execute',
        interactionKind: 'approval'
      },
      learningSummary: {
        taskId: 'task-1',
        sessionId: 'session-1',
        generatedAt: '2026-04-26T00:04:00.000Z',
        summary: 'Projection should remain whitelisted.',
        outcome: 'succeeded',
        evidenceRefs: [{ evidenceId: 'evidence-1', title: 'API contract', sourceKind: 'docs' }],
        memoryHints: [{ id: 'memory-1', summary: 'Use API projection fields only.', confidence: 0.8 }],
        ruleHints: [{ id: 'rule-1', summary: 'Do not leak raw metadata.', confidence: 0.9 }],
        skillDraftRefs: [{ draftId: 'draft-1', status: 'draft' }],
        capabilityGaps: [{ capabilityId: 'gap-1', label: 'Projection persistence', severity: 'medium' }]
      },
      learningSummaries: [
        {
          taskId: 'task-1',
          sessionId: 'session-1',
          generatedAt: '2026-04-26T00:04:00.000Z',
          summary: 'Projection should remain whitelisted.',
          outcome: 'succeeded',
          evidenceRefs: [{ evidenceId: 'evidence-1', title: 'API contract', sourceKind: 'docs' }],
          memoryHints: [{ id: 'memory-1', summary: 'Use API projection fields only.', confidence: 0.8 }],
          ruleHints: [{ id: 'rule-1', summary: 'Do not leak raw metadata.', confidence: 0.9 }],
          skillDraftRefs: [{ draftId: 'draft-1', status: 'draft' }],
          capabilityGaps: [{ capabilityId: 'gap-1', label: 'Projection persistence', severity: 'medium' }]
        }
      ],
      skillDrafts: [
        {
          draftId: 'draft-1',
          status: 'draft',
          title: 'Draft skill',
          summary: 'Candidate skill needs review',
          sourceTaskId: 'task-1',
          sessionId: 'session-1',
          confidence: 0.72,
          riskLevel: 'medium',
          createdAt: '2026-04-26T00:01:00.000Z',
          updatedAt: '2026-04-26T00:02:00.000Z',
          install: {
            receiptId: 'receipt-1',
            skillId: 'workspace-draft-draft-1',
            sourceId: 'workspace-skill-drafts',
            version: '20260426000300',
            status: 'installed',
            phase: 'installed',
            installedAt: '2026-04-26T00:03:00.000Z'
          },
          provenance: {
            sourceKind: 'workspace-draft',
            sourceTaskId: 'task-1',
            sourceEvidenceIds: ['evidence-1'],
            evidenceCount: 1,
            evidenceRefs: [
              {
                evidenceId: 'evidence-1',
                title: 'API contract',
                summary: 'Workspace projection contract',
                sourceKind: 'docs',
                citationId: 'agent-workspace.md'
              }
            ],
            manifestId: 'workspace-draft-draft-1',
            manifestSourceId: 'workspace-skill-drafts'
          },
          lifecycle: {
            draftStatus: 'draft',
            installStatus: 'installed',
            reusable: true,
            nextAction: 'ready_to_reuse'
          }
        },
        {
          draftId: 'draft-2',
          status: 'active',
          title: 'Active skill',
          summary: 'Skill is active',
          createdAt: '2026-04-25T00:01:00.000Z',
          updatedAt: '2026-04-25T00:02:00.000Z',
          decidedAt: '2026-04-25T00:03:00.000Z',
          decidedBy: 'reviewer-1'
        },
        {
          draftId: 'draft-3',
          status: 'trusted',
          title: 'Trusted skill',
          summary: 'Skill is trusted',
          createdAt: '2026-04-24T00:01:00.000Z',
          updatedAt: '2026-04-24T00:02:00.000Z'
        },
        {
          draftId: 'draft-4',
          status: 'rejected',
          title: 'Rejected skill',
          summary: 'Skill was rejected',
          createdAt: '2026-04-23T00:01:00.000Z',
          updatedAt: '2026-04-23T00:02:00.000Z'
        },
        {
          draftId: 'draft-5',
          status: 'retired',
          title: 'Retired skill',
          summary: 'Skill was retired',
          createdAt: '2026-04-22T00:01:00.000Z',
          updatedAt: '2026-04-22T00:02:00.000Z'
        },
        {
          draftId: 'draft-6',
          status: 'shadow',
          title: 'Shadow skill',
          summary: 'Skill is in shadow mode',
          createdAt: '2026-04-21T00:01:00.000Z',
          updatedAt: '2026-04-21T00:02:00.000Z'
        }
      ],
      reuseRecords: [
        {
          id: 'reuse-1',
          workspaceId: 'workspace-1',
          skillId: 'skill-1',
          reusedBy: {
            id: 'agent-supervisor',
            label: 'Supervisor',
            kind: 'agent'
          },
          taskId: 'task-1',
          outcome: 'succeeded',
          evidenceRefs: ['evidence-1'],
          reusedAt: '2026-04-26T00:05:00.000Z'
        }
      ],
      evidence: [
        {
          evidenceId: 'evidence-1',
          title: 'API contract',
          summary: 'Workspace projection contract',
          sourceKind: 'docs',
          citationId: 'agent-workspace.md'
        }
      ],
      reuseBadges: [{ kind: 'skill', id: 'skill-1', label: 'Workspace Builder', confidence: 0.91 }],
      capabilityGaps: [
        {
          capabilityId: 'gap-1',
          label: 'Projection persistence',
          severity: 'medium',
          suggestedAction: 'Keep MVP pure for now'
        }
      ],
      totals: {
        tasks: 1,
        learningSummaries: 1,
        skillDrafts: 6,
        pendingSkillDrafts: 2,
        reuseRecords: 1
      },
      skillDraftStatusCounts: {
        draft: 1,
        shadow: 1,
        active: 1,
        trusted: 1,
        rejected: 1,
        retired: 1
      }
    });

    const serialized = JSON.stringify(result);
    const collectKeys = (value: unknown): string[] => {
      if (!value || typeof value !== 'object') {
        return [];
      }
      if (Array.isArray(value)) {
        return value.flatMap(collectKeys);
      }
      return Object.entries(value).flatMap(([key, child]) => [key, ...collectKeys(child)]);
    };
    expect(collectKeys(result)).not.toEqual(expect.arrayContaining(['metadata', 'rawMetadata', 'internalMetadata']));
    expect(serialized).not.toContain('must-not-leak');
  });
});
