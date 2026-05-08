import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { RuntimeCentersQueryService } from '../../../src/runtime/centers/runtime-centers-query.service';
import {
  getRuntimeWorkspaceDraftStore,
  resetRuntimeWorkspaceDraftStore
} from '../../../src/runtime/centers/runtime-centers-workspace-drafts';
import { RuntimeSkillInstallRepository } from '../../../src/runtime/skills/runtime-skill-storage.repository';

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
      capabilityGaps: []
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

    const listedDrafts = await service.listWorkspaceSkillDrafts();
    expect(listedDrafts).toMatchObject([
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
          draftId: listedDrafts[0]?.draftId,
          status: 'draft',
          title: 'Backend draft store'
        }
      ]
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
    const installedRoot = await mkdtemp(join(tmpdir(), 'workspace-installed-'));
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          settings: { profile: 'platform' },
          getSkillInstallContext: () => ({
            settings: {
              skillReceiptsRoot: receiptsRoot
            },
            skillInstallRepository: new RuntimeSkillInstallRepository({ receiptsRoot, installedRoot })
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
        status: 'installed'
      },
      lifecycle: {
        reusable: true
      }
    });
  });

  it('wires workspace draft provenance evidence summaries from tasks, drafts and receipts', async () => {
    const receiptsRoot = await mkdtemp(join(tmpdir(), 'workspace-provenance-receipts-'));
    const installedRoot = await mkdtemp(join(tmpdir(), 'workspace-provenance-installed-'));
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          settings: { profile: 'platform' },
          getSkillInstallContext: () => ({
            settings: {
              skillReceiptsRoot: receiptsRoot
            },
            skillInstallRepository: new RuntimeSkillInstallRepository({ receiptsRoot, installedRoot })
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
      evidenceCount: 1
    });
    expect(result.skillDrafts[0]?.provenance?.evidenceRefs).toEqual([
      expect.objectContaining({
        evidenceId: 'evidence-provenance-1',
        sourceKind: 'workspace-docs'
      })
    ]);
  });

  it('wires recent tasks and drafts into the workspace center projection', async () => {
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

    const result = await service.getWorkspaceCenter();

    expect(result).toMatchObject({
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
      learningSummaries: [
        {
          taskId: 'task-workspace-1',
          sessionId: 'session-workspace-1',
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
    expect(result.evidence).toHaveLength(1);
    expect(result.reuseBadges).toHaveLength(4);
    expect(result.capabilityGaps).toHaveLength(1);
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
    expect(result.reuseBadges).toEqual([{ kind: 'skill', id: 'skill-1', label: 'skill-1' }]);
  });
});
