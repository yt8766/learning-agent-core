import { describe, expect, it } from 'vitest';

import type { AgentSkillDraft, AgentWorkspace } from '../src';
import {
  AgentSkillDraftDecisionSchema,
  AgentSkillDraftSchema,
  AgentSkillReuseRecordSchema,
  AgentWorkspaceSchema
} from '../src';

describe('@agent/core workspace contracts', () => {
  it('parses a valid agent workspace', () => {
    const workspace: AgentWorkspace = AgentWorkspaceSchema.parse({
      id: 'workspace-1',
      profileId: 'platform',
      name: 'Platform autonomy vault',
      scope: 'platform',
      status: 'active',
      owner: {
        id: 'agent-supervisor',
        label: 'Supervisor',
        kind: 'agent'
      },
      policyRefs: ['policy-1'],
      createdAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:00:00.000Z',
      summary: {
        workspaceId: 'workspace-1',
        scope: 'platform',
        activeDraftCount: 2,
        approvedDraftCount: 1,
        reuseRecordCount: 3,
        updatedAt: '2026-04-26T00:00:00.000Z'
      }
    });

    expect(workspace.summary?.activeDraftCount).toBe(2);
  });

  it('rejects workspaces with an invalid scope', () => {
    expect(() =>
      AgentWorkspaceSchema.parse({
        id: 'workspace-1',
        profileId: 'platform',
        name: 'Platform autonomy vault',
        scope: 'global',
        status: 'active',
        owner: {
          id: 'agent-supervisor',
          label: 'Supervisor',
          kind: 'agent'
        },
        createdAt: '2026-04-26T00:00:00.000Z',
        updatedAt: '2026-04-26T00:00:00.000Z'
      })
    ).toThrow();
  });

  it('parses a valid skill draft', () => {
    const draft: AgentSkillDraft = AgentSkillDraftSchema.parse({
      id: 'draft-1',
      workspaceId: 'workspace-1',
      title: 'Evidence-first report repair',
      description: 'Capture a repeatable repair flow for report bundle regressions.',
      triggerHints: ['report bundle regression'],
      bodyMarkdown: 'Run the evidence-first repair checklist.',
      requiredTools: ['read_file'],
      requiredConnectors: [],
      sourceTaskId: 'task-1',
      sourceEvidenceIds: ['evidence-1'],
      status: 'draft',
      riskLevel: 'medium',
      confidence: 0.72,
      createdBy: {
        id: 'agent-supervisor',
        label: 'Supervisor',
        kind: 'agent'
      },
      createdAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:00:00.000Z',
      install: {
        receiptId: 'receipt-1',
        skillId: 'workspace-draft-draft-1',
        sourceId: 'workspace-skill-drafts',
        version: '20260426010203',
        status: 'installed',
        phase: 'installed',
        installedAt: '2026-04-26T01:02:03.000Z'
      },
      provenance: {
        sourceKind: 'workspace-draft',
        sourceTaskId: 'task-1',
        sourceEvidenceIds: ['evidence-1'],
        manifestId: 'workspace-draft-draft-1',
        manifestSourceId: 'workspace-skill-drafts'
      },
      lifecycle: {
        draftStatus: 'active',
        installStatus: 'installed',
        reusable: true,
        nextAction: 'ready_to_reuse'
      }
    });

    expect(draft.riskLevel).toBe('medium');
    expect(draft.install?.receiptId).toBe('receipt-1');
    expect(draft.provenance?.manifestSourceId).toBe('workspace-skill-drafts');
    expect(draft.lifecycle?.nextAction).toBe('ready_to_reuse');
  });

  it('keeps skill draft provenance evidence summaries without allowing raw metadata', () => {
    const draft: AgentSkillDraft = AgentSkillDraftSchema.parse({
      id: 'draft-1',
      workspaceId: 'workspace-1',
      title: 'Evidence-first report repair',
      description: 'Capture a repeatable repair flow for report bundle regressions.',
      triggerHints: ['report bundle regression'],
      bodyMarkdown: 'Run the evidence-first repair checklist.',
      requiredTools: [],
      requiredConnectors: [],
      sourceTaskId: 'task-1',
      sourceEvidenceIds: ['evidence-1'],
      status: 'draft',
      riskLevel: 'medium',
      confidence: 0.72,
      createdBy: {
        id: 'agent-supervisor',
        label: 'Supervisor',
        kind: 'agent'
      },
      createdAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:00:00.000Z',
      provenance: {
        sourceKind: 'workspace-draft',
        sourceTaskId: 'task-1',
        sourceEvidenceIds: ['evidence-1'],
        evidenceCount: 1,
        evidenceRefs: [
          {
            evidenceId: 'evidence-1',
            title: 'Failing report bundle regression',
            summary: 'The generated report bundle failed schema validation.',
            sourceKind: 'task-evidence',
            citationId: 'EV-1'
          }
        ],
        manifestId: 'workspace-draft-draft-1',
        manifestSourceId: 'workspace-skill-drafts'
      }
    });

    expect(draft.provenance?.evidenceCount).toBe(1);
    expect(draft.provenance?.evidenceRefs).toEqual([
      {
        evidenceId: 'evidence-1',
        title: 'Failing report bundle regression',
        summary: 'The generated report bundle failed schema validation.',
        sourceKind: 'task-evidence',
        citationId: 'EV-1'
      }
    ]);

    expect(() =>
      AgentSkillDraftSchema.parse({
        id: 'draft-1',
        workspaceId: 'workspace-1',
        title: 'Evidence-first report repair',
        bodyMarkdown: 'Run the evidence-first repair checklist.',
        sourceTaskId: 'task-1',
        status: 'draft',
        riskLevel: 'medium',
        confidence: 0.72,
        createdBy: {
          id: 'agent-supervisor',
          label: 'Supervisor',
          kind: 'agent'
        },
        createdAt: '2026-04-26T00:00:00.000Z',
        updatedAt: '2026-04-26T00:00:00.000Z',
        provenance: {
          sourceKind: 'workspace-draft',
          evidenceCount: 1,
          evidenceRefs: [
            {
              evidenceId: 'evidence-1',
              rawMetadata: {
                providerPayload: 'must not cross the workspace contract'
              }
            }
          ]
        }
      })
    ).toThrow();
  });

  it('rejects skill drafts with invalid risk or status values', () => {
    expect(() =>
      AgentSkillDraftSchema.parse({
        id: 'draft-1',
        workspaceId: 'workspace-1',
        title: 'Evidence-first report repair',
        description: 'Capture a repeatable repair flow for report bundle regressions.',
        triggerHints: ['report bundle regression'],
        bodyMarkdown: 'Run the evidence-first repair checklist.',
        requiredTools: [],
        requiredConnectors: [],
        sourceTaskId: 'task-1',
        sourceEvidenceIds: ['evidence-1'],
        status: 'published',
        riskLevel: 'severe',
        confidence: 0.72,
        createdBy: {
          id: 'agent-supervisor',
          label: 'Supervisor',
          kind: 'agent'
        },
        createdAt: '2026-04-26T00:00:00.000Z',
        updatedAt: '2026-04-26T00:00:00.000Z'
      })
    ).toThrow();
  });

  it('rejects approving a high or critical skill draft without evidence', () => {
    expect(() =>
      AgentSkillDraftDecisionSchema.parse({
        draftId: 'draft-1',
        decision: 'approved',
        decidedBy: {
          id: 'human-1',
          label: 'Human reviewer',
          kind: 'human'
        },
        draftRiskLevel: 'high',
        evidenceRefs: [],
        decidedAt: '2026-04-26T00:00:00.000Z'
      })
    ).toThrow();
  });

  it('parses skill reuse records and defaults missing evidence refs', () => {
    const reuseRecord = AgentSkillReuseRecordSchema.parse({
      id: 'reuse-1',
      workspaceId: 'workspace-1',
      skillId: 'skill-1',
      reusedBy: {
        id: 'agent-supervisor',
        label: 'Supervisor',
        kind: 'agent'
      },
      taskId: 'task-1',
      sourceDraftId: 'draft-1',
      outcome: 'succeeded',
      reusedAt: '2026-04-26T00:00:00.000Z'
    });

    expect(reuseRecord.evidenceRefs).toEqual([]);
  });

  it('rejects skill reuse records with invalid outcomes', () => {
    expect(() =>
      AgentSkillReuseRecordSchema.parse({
        id: 'reuse-1',
        workspaceId: 'workspace-1',
        skillId: 'skill-1',
        reusedBy: {
          id: 'agent-supervisor',
          label: 'Supervisor',
          kind: 'agent'
        },
        outcome: 'unknown',
        reusedAt: '2026-04-26T00:00:00.000Z'
      })
    ).toThrow();
  });
});
