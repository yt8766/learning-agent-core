import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../src/bridges/supervisor-runtime-bridge', () => ({
  listBootstrapSkills: vi.fn(() => [
    { id: 'skill-a', displayName: 'Skill A' },
    { id: 'skill-b', displayName: 'Skill B' }
  ])
}));

vi.mock('../src/capabilities/capability-pool.shared', async () => {
  const actual = await vi.importActual<typeof import('../src/capabilities/capability-pool.shared')>(
    '../src/capabilities/capability-pool.shared'
  );
  return {
    ...actual,
    normalizeMinistryId: vi.fn((id: string) => {
      const map: Record<string, string> = {
        'hubu-search': 'hubu-search',
        'gongbu-code': 'gongbu-code',
        'bingbu-ops': 'bingbu-ops',
        'xingbu-review': 'xingbu-review',
        'libu-delivery': 'libu-delivery',
        'libu-governance': 'libu-governance'
      };
      return map[id] ?? null;
    }),
    normalizeSpecialistDomain: vi.fn((params: { domain: string }) => {
      const map: Record<string, string> = {
        'technical-architecture': 'technical-architecture',
        'risk-compliance': 'risk-compliance'
      };
      return map[params.domain] ?? null;
    }),
    resolveMinistryDisplay: vi.fn((ministry: string) => {
      const map: Record<string, string> = {
        'hubu-search': '户部',
        'gongbu-code': '工部',
        'bingbu-ops': '兵部',
        'xingbu-review': '刑部',
        'libu-delivery': '礼部',
        'libu-governance': '吏部'
      };
      return map[ministry] ?? ministry;
    }),
    resolveSpecialistDisplay: vi.fn((_domain: string, displayName: string) => displayName),
    CONNECTOR_TEMPLATE_TO_DISPLAY: {
      'github-mcp-template': 'GitHub MCP',
      'browser-mcp-template': 'Browser MCP',
      'lark-mcp-template': 'Lark MCP'
    },
    dedupeAttachments: actual.dedupeAttachments,
    dedupeAugmentations: actual.dedupeAugmentations
  };
});

import { buildInitialCapabilityState } from '../src/capabilities/capability-pool-bootstrap';

describe('capability-pool-bootstrap (direct)', () => {
  const now = '2026-05-10T12:00:00.000Z';

  describe('buildInitialCapabilityState', () => {
    it('includes bootstrap skills as attachments', () => {
      const result = buildInitialCapabilityState({ now });
      expect(result.capabilityAttachments.length).toBeGreaterThanOrEqual(2);
      const skillA = result.capabilityAttachments.find(a => a.id === 'bootstrap:skill-a');
      expect(skillA).toBeDefined();
      expect(skillA!.displayName).toBe('Skill A');
      expect(skillA!.kind).toBe('skill');
      expect(skillA!.enabled).toBe(true);
      expect(skillA!.permission).toBe('readonly');
      expect(skillA!.riskLevel).toBe('low');
      expect(skillA!.promotionStatus).toBe('active');
      expect(skillA!.owner.ownerType).toBe('shared');
      expect(skillA!.owner.trigger).toBe('bootstrap');
      expect(skillA!.capabilityTrust.trustLevel).toBe('medium');
    });

    it('returns empty augmentations with no hints', () => {
      const result = buildInitialCapabilityState({ now });
      expect(result.capabilityAugmentations).toEqual([]);
    });

    describe('with workflow', () => {
      it('adds ministry attachments for required ministries', () => {
        const result = buildInitialCapabilityState({
          now,
          workflow: {
            requiredMinistries: ['hubu-search', 'gongbu-code']
          } as any
        });
        const hubu = result.capabilityAttachments.find(a => a.id === 'ministry:hubu-search');
        expect(hubu).toBeDefined();
        expect(hubu!.owner.ownerType).toBe('ministry-owned');
        expect(hubu!.owner.trigger).toBe('workflow_required');
        expect(hubu!.permission).toBe('readonly');
        expect(hubu!.riskLevel).toBe('low');

        const gongbu = result.capabilityAttachments.find(a => a.id === 'ministry:gongbu-code');
        expect(gongbu).toBeDefined();
        expect(gongbu!.permission).toBe('write');
        expect(gongbu!.riskLevel).toBe('medium');
      });

      it('sets external-side-effect permission and high risk for bingbu-ops', () => {
        const result = buildInitialCapabilityState({
          now,
          workflow: {
            requiredMinistries: ['bingbu-ops']
          } as any
        });
        const bingbu = result.capabilityAttachments.find(a => a.id === 'ministry:bingbu-ops');
        expect(bingbu).toBeDefined();
        expect(bingbu!.permission).toBe('external-side-effect');
        expect(bingbu!.riskLevel).toBe('high');
      });

      it('skips ministry that normalizes to null', () => {
        const result = buildInitialCapabilityState({
          now,
          workflow: {
            requiredMinistries: ['unknown-ministry']
          } as any
        });
        const unknown = result.capabilityAttachments.find(a => a.id === 'ministry:unknown-ministry');
        expect(unknown).toBeUndefined();
      });
    });

    describe('with specialistLead', () => {
      it('adds specialist attachment', () => {
        const result = buildInitialCapabilityState({
          now,
          specialistLead: {
            domain: 'technical-architecture',
            displayName: 'Tech Architect'
          } as any
        });
        const specialist = result.capabilityAttachments.find(a => a.id === 'specialist:technical-architecture');
        expect(specialist).toBeDefined();
        expect(specialist!.owner.ownerType).toBe('specialist-owned');
        expect(specialist!.owner.trigger).toBe('workflow_required');
        expect(specialist!.permission).toBe('readonly');
        expect(specialist!.riskLevel).toBe('low');
      });

      it('uses domain when normalizeSpecialistDomain returns null', () => {
        const result = buildInitialCapabilityState({
          now,
          specialistLead: {
            domain: 'custom-domain',
            displayName: 'Custom'
          } as any
        });
        const specialist = result.capabilityAttachments.find(a => a.id === 'specialist:custom-domain');
        expect(specialist).toBeDefined();
      });
    });

    describe('with requestedHints', () => {
      it('adds requested skill attachment and augmentation', () => {
        const result = buildInitialCapabilityState({
          now,
          requestedHints: {
            requestedSkill: 'my-skill'
          } as any
        });
        const skill = result.capabilityAttachments.find(a => a.id === 'requested-skill:my-skill');
        expect(skill).toBeDefined();
        expect(skill!.owner.ownerType).toBe('user-attached');
        expect(skill!.owner.trigger).toBe('user_requested');
        expect(skill!.promotionStatus).toBe('candidate');

        const augmentation = result.capabilityAugmentations.find(a => a.id === 'augmentation:skill:my-skill');
        expect(augmentation).toBeDefined();
        expect(augmentation!.kind).toBe('skill');
        expect(augmentation!.requestedBy).toBe('user');
      });

      it('adds requested connector template attachment and augmentation', () => {
        const result = buildInitialCapabilityState({
          now,
          requestedHints: {
            requestedConnectorTemplate: 'github-mcp-template'
          } as any
        });
        const connector = result.capabilityAttachments.find(a => a.id === 'requested-connector:github-mcp-template');
        expect(connector).toBeDefined();
        expect(connector!.kind).toBe('connector');
        expect(connector!.permission).toBe('external-side-effect');
        expect(connector!.riskLevel).toBe('medium');
        expect(connector!.displayName).toBe('GitHub MCP');

        const augmentation = result.capabilityAugmentations.find(a => a.id === 'augmentation:github-mcp-template');
        expect(augmentation).toBeDefined();
        expect(augmentation!.kind).toBe('connector');
        expect(augmentation!.requestedBy).toBe('user');
      });

      it('uses connector template as displayName when not in CONNECTOR_TEMPLATE_TO_DISPLAY', () => {
        const result = buildInitialCapabilityState({
          now,
          requestedHints: {
            requestedConnectorTemplate: 'unknown-template'
          } as any
        });
        const connector = result.capabilityAttachments.find(a => a.id === 'requested-connector:unknown-template');
        expect(connector).toBeDefined();
        expect(connector!.displayName).toBe('unknown-template');
      });
    });

    describe('with seedCapabilityAttachments', () => {
      it('appends seed attachments', () => {
        const seed = [
          {
            id: 'seed-1',
            displayName: 'Seed Skill',
            kind: 'skill' as const,
            owner: { ownerType: 'user-attached' as const },
            enabled: true,
            createdAt: now,
            updatedAt: now
          }
        ];
        const result = buildInitialCapabilityState({ now, seedCapabilityAttachments: seed as any });
        const found = result.capabilityAttachments.find(a => a.id === 'seed-1');
        expect(found).toBeDefined();
        expect(found!.displayName).toBe('Seed Skill');
      });

      it('deduplicates attachments by id', () => {
        const seed = [
          {
            id: 'bootstrap:skill-a',
            displayName: 'Override',
            kind: 'skill' as const,
            owner: {} as any,
            enabled: true,
            createdAt: now,
            updatedAt: now
          }
        ];
        const result = buildInitialCapabilityState({ now, seedCapabilityAttachments: seed as any });
        const bootstrap = result.capabilityAttachments.filter(a => a.id === 'bootstrap:skill-a');
        expect(bootstrap).toHaveLength(1);
        expect(bootstrap[0].displayName).toBe('Override');
      });

      it('infers connector requirements from seed skill metadata', () => {
        const seed = [
          {
            id: 'seed-with-connector',
            displayName: 'Seed With Connector',
            kind: 'skill' as const,
            owner: { ownerType: 'specialist-owned' as const },
            enabled: true,
            metadata: {
              requiredConnectors: ['new-connector-template']
            },
            createdAt: now,
            updatedAt: now
          }
        ];
        const result = buildInitialCapabilityState({ now, seedCapabilityAttachments: seed as any });
        const augmentation = result.capabilityAugmentations.find(
          a => a.id === 'attachment-contract:seed-with-connector:new-connector-template'
        );
        expect(augmentation).toBeDefined();
        expect(augmentation!.kind).toBe('connector');
        expect(augmentation!.requestedBy).toBe('specialist');
      });

      it('skips connector requirement when already in attachments', () => {
        const seed = [
          {
            id: 'seed-github',
            displayName: 'Seed GitHub',
            kind: 'skill' as const,
            owner: { ownerType: 'user-attached' as const },
            enabled: true,
            metadata: {
              requiredConnectors: ['github-mcp-template']
            },
            createdAt: now,
            updatedAt: now
          }
        ];
        const result = buildInitialCapabilityState({
          now,
          requestedHints: { requestedConnectorTemplate: 'github-mcp-template' } as any,
          seedCapabilityAttachments: seed as any
        });
        const contractAug = result.capabilityAugmentations.find(
          a => a.id === 'attachment-contract:seed-github:github-mcp-template'
        );
        expect(contractAug).toBeUndefined();
      });

      it('skips preferred connector when already in augmentations via requestedHints', () => {
        const seed = [
          {
            id: 'seed-pref',
            displayName: 'Seed Pref',
            kind: 'skill' as const,
            owner: { ownerType: 'user-attached' as const },
            enabled: true,
            metadata: {
              preferredConnectors: ['browser-mcp-template']
            },
            createdAt: now,
            updatedAt: now
          }
        ];
        const result = buildInitialCapabilityState({
          now,
          requestedHints: { requestedConnectorTemplate: 'browser-mcp-template' } as any,
          seedCapabilityAttachments: seed as any
        });
        const contractAug = result.capabilityAugmentations.find(
          a => a.id === 'attachment-contract:seed-pref:browser-mcp-template'
        );
        expect(contractAug).toBeUndefined();
      });

      it('skips non-skill seed attachments for connector requirement check', () => {
        const seed = [
          {
            id: 'seed-connector',
            displayName: 'Seed Connector',
            kind: 'connector' as const,
            owner: { ownerType: 'user-attached' as const },
            enabled: true,
            metadata: {
              requiredConnectors: ['some-template']
            },
            createdAt: now,
            updatedAt: now
          }
        ];
        const result = buildInitialCapabilityState({ now, seedCapabilityAttachments: seed as any });
        const contractAug = result.capabilityAugmentations.find(
          a => a.id === 'attachment-contract:seed-connector:some-template'
        );
        expect(contractAug).toBeUndefined();
      });

      it('skips empty connector template strings', () => {
        const seed = [
          {
            id: 'seed-empty-conn',
            displayName: 'Seed Empty',
            kind: 'skill' as const,
            owner: { ownerType: 'user-attached' as const },
            enabled: true,
            metadata: {
              requiredConnectors: ['']
            },
            createdAt: now,
            updatedAt: now
          }
        ];
        const result = buildInitialCapabilityState({ now, seedCapabilityAttachments: seed as any });
        expect(result.capabilityAugmentations.filter(a => a.id.startsWith('attachment-contract:'))).toHaveLength(0);
      });
    });

    describe('with seedCapabilityAugmentations', () => {
      it('includes seed augmentations', () => {
        const seedAug = [
          { id: 'seed-aug-1', kind: 'connector' as const, status: 'active' as const, createdAt: now, updatedAt: now }
        ];
        const result = buildInitialCapabilityState({ now, seedCapabilityAugmentations: seedAug as any });
        expect(result.capabilityAugmentations.find(a => a.id === 'seed-aug-1')).toBeDefined();
      });
    });

    it('works with all parameters combined', () => {
      const result = buildInitialCapabilityState({
        now,
        workflow: { requiredMinistries: ['hubu-search'] } as any,
        specialistLead: { domain: 'technical-architecture', displayName: 'Arch' } as any,
        requestedHints: { requestedSkill: 'my-skill', requestedConnectorTemplate: 'github-mcp-template' } as any,
        seedCapabilityAttachments: [
          {
            id: 'extra',
            displayName: 'Extra',
            kind: 'skill' as const,
            owner: {} as any,
            enabled: true,
            createdAt: now,
            updatedAt: now
          }
        ] as any,
        seedCapabilityAugmentations: [
          { id: 'extra-aug', kind: 'skill' as const, status: 'active' as const, createdAt: now, updatedAt: now }
        ] as any
      });
      expect(result.capabilityAttachments.length).toBeGreaterThan(2);
      expect(result.capabilityAugmentations.length).toBeGreaterThan(0);
    });
  });
});
