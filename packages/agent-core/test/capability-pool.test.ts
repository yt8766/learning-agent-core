import { describe, expect, it } from 'vitest';

import {
  buildInitialCapabilityState,
  buildMinistryStagePreferences,
  buildWorkerSelectionPreferences
} from '../src/capabilities/capability-pool';

describe('capability-pool ministry stage preferences', () => {
  it('prefers bingbu execution when connector affinity points to browser or lark', () => {
    const preferences = buildMinistryStagePreferences({
      capabilityAttachments: [
        {
          id: 'requested-connector:lark-mcp-template',
          displayName: 'Lark MCP',
          kind: 'connector',
          owner: {
            ownerType: 'user-attached',
            ownerId: 'workspace',
            capabilityType: 'connector',
            scope: 'session',
            trigger: 'user_requested'
          },
          enabled: true,
          createdAt: '2026-03-29T00:00:00.000Z',
          updatedAt: '2026-03-29T00:00:00.000Z'
        }
      ],
      capabilityAugmentations: [],
      requestedHints: {
        requestedConnectorTemplate: 'lark-mcp-template'
      },
      specialistLead: {
        id: 'general-assistant',
        displayName: '通用助理',
        domain: 'general-assistant',
        reason: 'default'
      },
      resolvedWorkflow: {
        id: 'workflow',
        displayName: 'Workflow',
        requiredMinistries: ['libu-router', 'bingbu-ops', 'libu-docs'],
        outputContract: {
          type: 'summary'
        },
        approvalPolicy: 'manual'
      }
    } as any);

    expect(preferences.execution).toBe('bingbu-ops');
  });

  it('prefers xingbu review for risk-compliance specialist and high-risk approvals', () => {
    const preferences = buildMinistryStagePreferences({
      capabilityAttachments: [],
      capabilityAugmentations: [],
      specialistLead: {
        id: 'risk-compliance',
        displayName: '风控合规专家',
        domain: 'risk-compliance',
        reason: 'risk'
      },
      pendingApproval: {
        intent: 'call_external_api',
        decision: 'pending',
        riskLevel: 'high'
      },
      resolvedWorkflow: {
        id: 'workflow',
        displayName: 'Workflow',
        requiredMinistries: ['libu-router', 'xingbu-review', 'libu-docs'],
        outputContract: {
          type: 'summary'
        },
        approvalPolicy: 'manual'
      }
    } as any);

    expect(preferences.review).toBe('xingbu-review');
  });

  it('keeps xingbu as the default final gate whenever the workflow declares review support', () => {
    const preferences = buildMinistryStagePreferences({
      capabilityAttachments: [],
      capabilityAugmentations: [],
      specialistLead: {
        id: 'general-assistant',
        displayName: '通用助理',
        domain: 'general-assistant',
        reason: 'default'
      },
      resolvedWorkflow: {
        id: 'workflow',
        displayName: 'Workflow',
        requiredMinistries: ['libu-router', 'gongbu-code', 'xingbu-review', 'libu-docs'],
        outputContract: {
          type: 'summary'
        },
        approvalPolicy: 'manual'
      }
    } as any);

    expect(preferences.review).toBe('xingbu-review');
  });

  it('treats skill attachment connector contracts as execution affinity', () => {
    const preferences = buildMinistryStagePreferences({
      capabilityAttachments: [
        {
          id: 'user-skill:lark-skill',
          displayName: 'Lark notify skill',
          kind: 'skill',
          owner: {
            ownerType: 'user-attached',
            ownerId: 'session:test',
            capabilityType: 'skill',
            scope: 'workspace',
            trigger: 'user_requested'
          },
          enabled: true,
          metadata: {
            requiredConnectors: ['lark-mcp-template']
          },
          createdAt: '2026-03-29T00:00:00.000Z',
          updatedAt: '2026-03-29T00:00:00.000Z'
        }
      ],
      capabilityAugmentations: [],
      specialistLead: {
        id: 'general-assistant',
        displayName: '通用助理',
        domain: 'general-assistant',
        reason: 'default'
      },
      resolvedWorkflow: {
        id: 'workflow',
        displayName: 'Workflow',
        requiredMinistries: ['libu-router', 'bingbu-ops', 'libu-docs'],
        outputContract: {
          type: 'summary'
        },
        approvalPolicy: 'manual'
      }
    } as any);

    expect(preferences.execution).toBe('bingbu-ops');
  });

  it('compiles session skill contracts into connector augmentations for the new task', () => {
    const state = buildInitialCapabilityState({
      now: '2026-03-29T00:00:00.000Z',
      requestedHints: undefined,
      seedCapabilityAttachments: [
        {
          id: 'user-skill:lark-skill',
          displayName: 'Lark notify skill',
          kind: 'skill',
          owner: {
            ownerType: 'user-attached',
            ownerId: 'session:test',
            capabilityType: 'skill',
            scope: 'workspace',
            trigger: 'user_requested'
          },
          enabled: true,
          metadata: {
            requiredConnectors: ['lark-mcp-template']
          },
          createdAt: '2026-03-29T00:00:00.000Z',
          updatedAt: '2026-03-29T00:00:00.000Z'
        }
      ]
    });

    expect(state.capabilityAugmentations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'connector',
          target: 'lark-mcp-template',
          status: 'suggested'
        })
      ])
    );
  });

  it('turns low-trust installed workers into route avoidance signals', () => {
    const preferences = buildWorkerSelectionPreferences({
      capabilityAttachments: [
        {
          id: 'installed-skill:repo_refactor',
          displayName: 'Repo Refactor',
          kind: 'skill',
          owner: {
            ownerType: 'runtime-derived',
            ownerId: 'session:test',
            capabilityType: 'skill',
            scope: 'session',
            trigger: 'capability_gap_detected'
          },
          enabled: true,
          capabilityTrust: {
            trustLevel: 'low',
            trustTrend: 'down',
            lastReason: '近期终审阻断较多。',
            updatedAt: '2026-03-29T00:00:00.000Z'
          },
          createdAt: '2026-03-29T00:00:00.000Z',
          updatedAt: '2026-03-29T00:00:00.000Z'
        },
        {
          id: 'ministry:bingbu-ops',
          displayName: '兵部能力池',
          kind: 'skill',
          owner: {
            ownerType: 'ministry-owned',
            ownerId: 'bingbu-ops',
            capabilityType: 'skill',
            scope: 'task',
            trigger: 'workflow_required'
          },
          enabled: true,
          capabilityTrust: {
            trustLevel: 'low',
            trustTrend: 'down',
            lastReason: '演武场最近熔断偏多。',
            updatedAt: '2026-03-29T00:00:00.000Z'
          },
          createdAt: '2026-03-29T00:00:00.000Z',
          updatedAt: '2026-03-29T00:00:00.000Z'
        }
      ],
      usedInstalledSkills: ['installed-skill:repo_refactor']
    } as any);

    expect(preferences.avoidedWorkerIds).toContain('installed-skill:repo_refactor');
    expect(preferences.avoidedTags).toEqual(expect.arrayContaining(['sandbox', 'terminal', 'release']));
  });

  it('routes research through hubu when the selected specialist is under governance watch', () => {
    const preferences = buildMinistryStagePreferences({
      capabilityAttachments: [
        {
          id: 'specialist:technical-architecture',
          displayName: '技术架构能力池',
          kind: 'skill',
          owner: {
            ownerType: 'specialist-owned',
            ownerId: 'technical-architecture',
            capabilityType: 'skill',
            scope: 'task',
            trigger: 'workflow_required'
          },
          enabled: true,
          capabilityTrust: {
            trustLevel: 'low',
            trustTrend: 'down',
            lastReason: '近期多次被终审打回。',
            updatedAt: '2026-03-29T00:00:00.000Z'
          },
          createdAt: '2026-03-29T00:00:00.000Z',
          updatedAt: '2026-03-29T00:00:00.000Z'
        }
      ],
      capabilityAugmentations: [],
      specialistLead: {
        id: 'technical-architecture',
        displayName: '技术架构专家',
        domain: 'technical-architecture',
        reason: '需要架构判断'
      },
      resolvedWorkflow: {
        id: 'workflow',
        displayName: 'Workflow',
        requiredMinistries: ['libu-router', 'hubu-search', 'gongbu-code', 'libu-docs'],
        outputContract: {
          type: 'summary'
        },
        approvalPolicy: 'manual'
      }
    } as any);

    expect(preferences.research).toBe('hubu-search');
  });

  it('switches execution to bingbu when gongbu governance is degraded and connector affinity exists', () => {
    const preferences = buildMinistryStagePreferences({
      capabilityAttachments: [
        {
          id: 'ministry:gongbu-code',
          displayName: '工部能力池',
          kind: 'skill',
          owner: {
            ownerType: 'ministry-owned',
            ownerId: 'gongbu-code',
            capabilityType: 'skill',
            scope: 'task',
            trigger: 'workflow_required'
          },
          enabled: true,
          capabilityTrust: {
            trustLevel: 'low',
            trustTrend: 'down',
            lastReason: '近期代码交付质量不稳。',
            updatedAt: '2026-03-29T00:00:00.000Z'
          },
          createdAt: '2026-03-29T00:00:00.000Z',
          updatedAt: '2026-03-29T00:00:00.000Z'
        },
        {
          id: 'requested-connector:browser-mcp-template',
          displayName: 'Browser MCP',
          kind: 'connector',
          owner: {
            ownerType: 'user-attached',
            ownerId: 'workspace',
            capabilityType: 'connector',
            scope: 'session',
            trigger: 'user_requested'
          },
          enabled: true,
          createdAt: '2026-03-29T00:00:00.000Z',
          updatedAt: '2026-03-29T00:00:00.000Z'
        }
      ],
      capabilityAugmentations: [],
      requestedHints: {
        requestedConnectorTemplate: 'browser-mcp-template'
      },
      specialistLead: {
        id: 'technical-architecture',
        displayName: '技术架构专家',
        domain: 'technical-architecture',
        reason: '需要落地执行'
      },
      resolvedWorkflow: {
        id: 'workflow',
        displayName: 'Workflow',
        requiredMinistries: ['libu-router', 'gongbu-code', 'bingbu-ops', 'libu-docs'],
        outputContract: {
          type: 'summary'
        },
        approvalPolicy: 'manual'
      }
    } as any);

    expect(preferences.execution).toBe('bingbu-ops');
  });
});
