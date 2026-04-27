import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { RuntimeCentersQueryService } from '../../../src/runtime/centers/runtime-centers-query.service';
import {
  getRuntimeWorkspaceDraftStore,
  resetRuntimeWorkspaceDraftStore
} from '../../../src/runtime/centers/runtime-centers-workspace-drafts';

describe('RuntimeCentersQueryService workspace center', () => {
  afterEach(() => {
    resetRuntimeWorkspaceDraftStore();
  });

  it('returns a stable Agent Workspace MVP projection for the active runtime profile', async () => {
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          settings: { profile: 'agent-admin' }
        }) as any
    );

    const result = await service.getWorkspaceCenter();

    expect(result).toMatchObject({
      workspaceId: 'workspace-agent-admin',
      status: 'idle',
      learningSummaries: [],
      skillDrafts: [],
      evidence: [],
      reuseBadges: [],
      capabilityGaps: [],
      totals: {
        tasks: 0,
        learningSummaries: 0,
        skillDrafts: 0,
        pendingSkillDrafts: 0
      },
      skillDraftStatusCounts: {
        draft: 0,
        shadow: 0,
        active: 0,
        trusted: 0,
        rejected: 0,
        retired: 0
      }
    });
    expect(result.generatedAt).toEqual(expect.any(String));
    expect(result.updatedAt).toBe(result.generatedAt);
  });

  it('lists workspace skill drafts from the workspace center projection', async () => {
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          settings: { profile: 'platform' }
        }) as any
    );

    await expect(service.listWorkspaceSkillDrafts()).resolves.toEqual([]);
  });

  it('returns seeded workspace skill drafts from the draft store', async () => {
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          settings: { profile: 'platform' }
        }) as any
    );

    await getRuntimeWorkspaceDraftStore().seedDraft({
      workspaceId: 'workspace-platform',
      title: 'Backend draft store',
      description: 'Drafts should be visible from the workspace center API.',
      bodyMarkdown: '# Backend draft store',
      sourceTaskId: 'task-draft-store',
      source: 'workspace-vault',
      riskLevel: 'low',
      confidence: 0.91
    });

    await expect(service.listWorkspaceSkillDrafts()).resolves.toMatchObject([
      {
        draftId: expect.any(String),
        status: 'draft',
        title: 'Backend draft store',
        summary: 'Drafts should be visible from the workspace center API.',
        sourceTaskId: 'task-draft-store',
        confidence: 0.91,
        riskLevel: 'low'
      }
    ]);

    await expect(service.getWorkspaceCenter()).resolves.toMatchObject({
      skillDrafts: [
        {
          status: 'draft',
          title: 'Backend draft store'
        }
      ],
      totals: {
        skillDrafts: 1,
        pendingSkillDrafts: 1
      },
      skillDraftStatusCounts: {
        draft: 1
      }
    });
  });

  it('filters workspace skill drafts by query fields while keeping the array response shape', async () => {
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          settings: { profile: 'platform' },
          orchestrator: {
            listTasks: () => [
              {
                id: 'task-session-a',
                sessionId: 'session-a',
                goal: 'Session A draft',
                status: 'completed'
              },
              {
                id: 'task-session-b',
                sessionId: 'session-b',
                goal: 'Session B draft',
                status: 'completed'
              }
            ]
          }
        }) as any
    );

    const draftStore = getRuntimeWorkspaceDraftStore();
    await draftStore.seedDraft({
      workspaceId: 'workspace-platform',
      title: 'Session A first draft',
      bodyMarkdown: '# A first',
      sourceTaskId: 'task-session-a',
      source: 'workspace-vault'
    });
    await draftStore.seedDraft({
      workspaceId: 'workspace-platform',
      title: 'Session B draft',
      bodyMarkdown: '# B',
      sourceTaskId: 'task-session-b',
      source: 'workspace-vault'
    });
    await draftStore.seedDraft({
      workspaceId: 'workspace-platform',
      title: 'Session A manual draft',
      bodyMarkdown: '# A manual',
      sourceTaskId: 'task-session-a',
      source: 'manual'
    });
    await draftStore.seedDraft({
      workspaceId: 'workspace-platform',
      title: 'Session A second draft',
      bodyMarkdown: '# A second',
      sourceTaskId: 'task-session-a',
      source: 'workspace-vault'
    });

    await expect(
      service.listWorkspaceSkillDrafts({
        status: 'draft',
        source: 'workspace-vault',
        sourceTaskId: 'task-session-a',
        sessionId: 'session-a',
        limit: '2'
      })
    ).resolves.toMatchObject([
      {
        status: 'draft',
        title: 'Session A first draft',
        sourceTaskId: 'task-session-a'
      },
      {
        status: 'draft',
        title: 'Session A second draft',
        sourceTaskId: 'task-session-a'
      }
    ]);
  });

  it('attaches workspace draft install receipt summaries to matching skill drafts', async () => {
    const receiptsRoot = await mkdtemp(join(tmpdir(), 'workspace-receipts-'));
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          settings: { profile: 'platform' },
          getSkillInstallContext: () => ({
            settings: {
              skillReceiptsRoot: receiptsRoot
            }
          })
        }) as any
    );

    await getRuntimeWorkspaceDraftStore().seedDraft({
      workspaceId: 'workspace-platform',
      title: 'Receipt-linked draft',
      bodyMarkdown: '# Receipt linked',
      sourceTaskId: 'task-receipt',
      source: 'workspace-vault',
      riskLevel: 'medium',
      confidence: 0.83
    });

    const [draft] = await service.listWorkspaceSkillDrafts();
    await writeFile(
      join(receiptsRoot, 'receipts.json'),
      JSON.stringify(
        [
          {
            id: 'receipt-workspace-draft',
            skillId: `workspace-draft-${draft!.draftId}`,
            version: '20260426010203',
            sourceId: 'workspace-skill-drafts',
            status: 'installed',
            phase: 'installed',
            result: 'installed_to_lab',
            downloadRef: '/tmp/raw-staging/SKILL.md',
            installedAt: '2026-04-26T01:02:03.000Z',
            failureDetail: 'raw stack must not leak'
          }
        ],
        null,
        2
      )
    );

    const result = await service.getWorkspaceCenter();

    expect(result.skillDrafts[0]).toMatchObject({
      draftId: draft!.draftId,
      install: {
        receiptId: 'receipt-workspace-draft',
        skillId: `workspace-draft-${draft!.draftId}`,
        sourceId: 'workspace-skill-drafts',
        status: 'installed',
        phase: 'installed',
        installedAt: '2026-04-26T01:02:03.000Z'
      },
      provenance: {
        sourceKind: 'workspace-draft',
        sourceTaskId: 'task-receipt',
        manifestId: `workspace-draft-${draft!.draftId}`,
        manifestSourceId: 'workspace-skill-drafts'
      },
      lifecycle: {
        draftStatus: 'draft',
        installStatus: 'installed',
        reusable: true,
        nextAction: 'ready_to_reuse'
      }
    });
    expect(JSON.stringify(result.skillDrafts[0])).not.toContain('raw stack must not leak');
    expect(JSON.stringify(result.skillDrafts[0])).not.toContain('/tmp/raw-staging');
  });

  it('projects workspace draft provenance evidence summaries without leaking raw receipt or evidence metadata', async () => {
    const receiptsRoot = await mkdtemp(join(tmpdir(), 'workspace-provenance-receipts-'));
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          settings: { profile: 'platform' },
          getSkillInstallContext: () => ({
            settings: {
              skillReceiptsRoot: receiptsRoot
            }
          }),
          orchestrator: {
            listTasks: () => [
              {
                id: 'task-provenance',
                goal: 'Install a workspace skill draft with evidence',
                status: 'completed',
                sessionId: 'session-provenance',
                externalSources: [
                  {
                    id: 'evidence-provenance-1',
                    taskId: 'task-provenance',
                    sourceType: 'workspace-docs',
                    sourceUrl: 'docs://workspace/provenance',
                    summary: 'Workspace evidence supports the skill draft.',
                    rawMetadata: { providerPayload: 'raw evidence must not leak' }
                  },
                  {
                    id: 'evidence-unrelated',
                    taskId: 'task-provenance',
                    sourceType: 'workspace-docs',
                    sourceUrl: 'docs://workspace/unrelated',
                    summary: 'Unrelated evidence should not be linked to the draft.'
                  }
                ],
                updatedAt: '2026-04-26T12:00:00.000Z',
                createdAt: '2026-04-26T11:50:00.000Z'
              }
            ]
          }
        }) as any
    );

    await getRuntimeWorkspaceDraftStore().seedDraft({
      workspaceId: 'workspace-platform',
      title: 'Evidence-backed draft',
      bodyMarkdown: '# Evidence backed draft',
      sourceTaskId: 'task-provenance',
      source: 'workspace-vault',
      sourceEvidenceIds: ['evidence-provenance-1'],
      riskLevel: 'medium',
      confidence: 0.83
    });

    const [draft] = await service.listWorkspaceSkillDrafts();
    await writeFile(
      join(receiptsRoot, 'receipts.json'),
      JSON.stringify(
        [
          {
            id: 'receipt-provenance',
            skillId: `workspace-draft-${draft!.draftId}`,
            version: '20260426120000',
            sourceId: 'workspace-skill-drafts',
            sourceDraftId: draft!.draftId,
            status: 'installed',
            phase: 'installed',
            result: 'installed_to_lab',
            downloadRef: '/tmp/raw-provenance/SKILL.md',
            installedAt: '2026-04-26T12:00:00.000Z',
            failureDetail: 'raw failure detail must not leak',
            rawMetadata: { installerPayload: 'raw receipt metadata must not leak' }
          }
        ],
        null,
        2
      )
    );

    const result = await service.getWorkspaceCenter();

    expect(result.skillDrafts[0]?.provenance).toMatchObject({
      sourceKind: 'workspace-draft',
      sourceTaskId: 'task-provenance',
      sourceEvidenceIds: ['evidence-provenance-1'],
      evidenceCount: 1,
      evidenceRefs: [
        {
          evidenceId: 'evidence-provenance-1',
          title: 'docs://workspace/provenance',
          summary: 'Workspace evidence supports the skill draft.',
          sourceKind: 'workspace-docs',
          citationId: 'docs://workspace/provenance'
        }
      ],
      manifestId: `workspace-draft-${draft!.draftId}`,
      manifestSourceId: 'workspace-skill-drafts'
    });
    expect(JSON.stringify(result.skillDrafts[0])).not.toContain('raw evidence must not leak');
    expect(JSON.stringify(result.skillDrafts[0])).not.toContain('raw failure detail must not leak');
    expect(JSON.stringify(result.skillDrafts[0])).not.toContain('raw receipt metadata must not leak');
    expect(JSON.stringify(result.skillDrafts[0])).not.toContain('/tmp/raw-provenance');
  });

  it('projects recent task learning, evidence, reuse, and capability gaps into the workspace center', async () => {
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          settings: { profile: 'platform' },
          orchestrator: {
            listTasks: () => [
              {
                id: 'task-workspace-1',
                goal: 'Stabilize workspace flywheel',
                status: 'completed',
                sessionId: 'session-workspace-1',
                executionMode: 'execute',
                result: 'Workspace flywheel stabilized.',
                externalSources: [
                  {
                    id: 'evidence-workspace-1',
                    taskId: 'task-workspace-1',
                    sourceType: 'workspace-docs',
                    sourceUrl: 'docs://workspace',
                    trustClass: 'internal',
                    summary: 'Workspace docs captured the implementation boundary.',
                    createdAt: '2026-04-26T10:00:00.000Z'
                  }
                ],
                reusedMemories: ['memory-1'],
                reusedRules: ['rule-1'],
                reusedSkills: ['skill-1'],
                usedInstalledSkills: ['installed-skill-1'],
                learningEvaluation: {
                  score: 82,
                  confidence: 'high',
                  shouldLearn: true,
                  rationale: '任务完成后可沉淀 workspace flywheel 经验。',
                  notes: ['复用和证据都足够。'],
                  recommendedCandidateIds: ['candidate-1'],
                  autoConfirmCandidateIds: [],
                  sourceSummary: {
                    externalSourceCount: 0,
                    internalSourceCount: 1,
                    reusedMemoryCount: 1,
                    reusedRuleCount: 1,
                    reusedSkillCount: 2
                  }
                },
                skillSearch: {
                  capabilityGapDetected: true,
                  query: 'workspace-vault',
                  gapSummary: '需要补齐 workspace vault 聚合。'
                },
                updatedAt: '2026-04-26T10:30:00.000Z',
                createdAt: '2026-04-26T10:00:00.000Z'
              }
            ]
          }
        }) as any
    );

    await getRuntimeWorkspaceDraftStore().seedDraft({
      workspaceId: 'workspace-platform',
      title: 'Workspace projection draft',
      bodyMarkdown: '# Workspace projection',
      sourceTaskId: 'task-workspace-1',
      source: 'workspace-vault',
      riskLevel: 'low',
      confidence: 0.76
    });

    await expect(service.getWorkspaceCenter()).resolves.toMatchObject({
      workspaceId: 'workspace-platform',
      sessionId: 'session-workspace-1',
      taskId: 'task-workspace-1',
      status: 'completed',
      currentTask: {
        taskId: 'task-workspace-1',
        title: 'Stabilize workspace flywheel',
        status: 'completed',
        executionMode: 'execute'
      },
      evidence: [
        {
          evidenceId: 'evidence-workspace-1',
          sourceKind: 'workspace-docs',
          summary: 'Workspace docs captured the implementation boundary.'
        }
      ],
      reuseBadges: expect.arrayContaining([
        { kind: 'memory', id: 'memory-1', label: 'memory-1' },
        { kind: 'rule', id: 'rule-1', label: 'rule-1' },
        { kind: 'skill', id: 'skill-1', label: 'skill-1' },
        { kind: 'skill', id: 'installed-skill-1', label: 'installed-skill-1' }
      ]),
      capabilityGaps: [
        {
          capabilityId: 'workspace-vault',
          label: '需要补齐 workspace vault 聚合。'
        }
      ],
      learningSummaries: [
        {
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
          skillDraftRefs: [
            {
              status: 'draft'
            }
          ]
        }
      ],
      totals: {
        tasks: 1,
        learningSummaries: 1,
        skillDrafts: 1,
        pendingSkillDrafts: 1
      }
    });
  });

  it('projects persisted workspace skill reuse records and dedupes matching task skill badges', async () => {
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          settings: { profile: 'platform' },
          runtimeStateRepository: {
            load: async () => ({
              workspaceSkillReuseRecords: [
                {
                  id: 'reuse-task-workspace-1-installed-skill-1',
                  workspaceId: 'workspace-platform',
                  skillId: 'skill-1',
                  reusedBy: {
                    id: 'agent-supervisor',
                    label: 'Supervisor',
                    kind: 'agent'
                  },
                  taskId: 'task-workspace-1',
                  outcome: 'succeeded',
                  evidenceRefs: ['evidence-workspace-1'],
                  reusedAt: '2026-04-26T11:00:00.000Z'
                }
              ]
            })
          },
          orchestrator: {
            listTasks: () => [
              {
                id: 'task-workspace-1',
                goal: 'Reuse an installed skill',
                status: 'completed',
                reusedSkills: ['skill-1'],
                usedInstalledSkills: ['installed-skill:skill-1'],
                updatedAt: '2026-04-26T11:10:00.000Z',
                createdAt: '2026-04-26T11:00:00.000Z'
              }
            ]
          }
        }) as any
    );

    const result = await service.getWorkspaceCenter();

    expect(result.reuseRecords).toEqual([
      {
        id: 'reuse-task-workspace-1-installed-skill-1',
        workspaceId: 'workspace-platform',
        skillId: 'skill-1',
        reusedBy: {
          id: 'agent-supervisor',
          label: 'Supervisor',
          kind: 'agent'
        },
        taskId: 'task-workspace-1',
        outcome: 'succeeded',
        evidenceRefs: ['evidence-workspace-1'],
        reusedAt: '2026-04-26T11:00:00.000Z'
      }
    ]);
    expect(result.reuseBadges.filter(badge => badge.kind === 'skill' && badge.id === 'skill-1')).toHaveLength(1);
    expect(result.reuseBadges).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'skill', id: 'installed-skill:skill-1' })])
    );
  });
});
