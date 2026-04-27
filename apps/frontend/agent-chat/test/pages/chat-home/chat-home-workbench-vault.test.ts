import { describe, expect, it } from 'vitest';

import { buildWorkspaceVaultSignals } from '@/pages/chat-home/chat-home-workbench';

describe('chat-home workspace vault install summaries', () => {
  it('surfaces skill install receipt readiness from existing checkpoint/workbench data', () => {
    const signals = buildWorkspaceVaultSignals({
      activeSession: {
        id: 'session-1',
        title: '当前会话',
        status: 'completed',
        createdAt: '2026-04-26T00:00:00.000Z',
        updatedAt: '2026-04-26T00:00:00.000Z'
      },
      messages: [],
      pendingApprovals: [],
      checkpoint: {
        externalSources: [],
        reusedMemories: [],
        reusedRules: [],
        reusedSkills: [],
        usedInstalledSkills: ['workspace-draft-repo-inspector'],
        usedCompanyWorkers: [],
        connectorRefs: [],
        learningEvaluation: {
          score: 0.86,
          confidence: 'high',
          notes: [],
          recommendedCandidateIds: ['draft-1'],
          autoConfirmCandidateIds: [],
          sourceSummary: {
            externalSourceCount: 0,
            internalSourceCount: 0,
            reusedMemoryCount: 0,
            reusedRuleCount: 0,
            reusedSkillCount: 0
          }
        },
        skillSearch: {
          capabilityGapDetected: false,
          status: 'auto-installed',
          safetyNotes: [],
          suggestions: [
            {
              id: 'skill-suggestion-1',
              kind: 'remote-skill',
              displayName: 'repo-inspector',
              summary: '分析仓库结构',
              score: 0.91,
              availability: 'ready',
              reason: 'workspace draft 已安装',
              requiredCapabilities: ['repo.read'],
              installState: {
                receiptId: 'receipt-1',
                status: 'installed',
                phase: 'installed',
                installedAt: '2026-04-26T00:50:00.000Z'
              }
            }
          ]
        }
      }
    } as never);

    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Install receipts',
          value: '1 installed',
          detail: 'receipt-1'
        })
      ])
    );
  });
});
