import { describe, expect, it } from 'vitest';

import { WorkerRegistry, createDefaultWorkerRegistry } from '../src/governance/worker-registry';

describe('worker-registry', () => {
  describe('WorkerRegistry', () => {
    it('registers and retrieves workers', () => {
      const registry = new WorkerRegistry([]);
      registry.register({
        id: 'test-worker',
        ministry: 'hubu-search',
        kind: 'core',
        displayName: 'Test Worker',
        defaultModel: 'test',
        supportedCapabilities: [],
        reviewPolicy: 'none',
        tags: ['test']
      });
      expect(registry.get('test-worker')).toBeDefined();
      expect(registry.get('test-worker')!.displayName).toBe('Test Worker');
    });

    it('returns undefined for unknown worker', () => {
      const registry = new WorkerRegistry([]);
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('registers multiple workers', () => {
      const registry = new WorkerRegistry([]);
      registry.registerMany([
        {
          id: 'w1',
          ministry: 'hubu-search',
          kind: 'core',
          displayName: 'W1',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        },
        {
          id: 'w2',
          ministry: 'gongbu-code',
          kind: 'core',
          displayName: 'W2',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        }
      ]);
      expect(registry.list()).toHaveLength(2);
    });

    it('lists all workers', () => {
      const registry = createDefaultWorkerRegistry();
      expect(registry.list().length).toBeGreaterThan(0);
    });

    it('lists workers by ministry', () => {
      const registry = createDefaultWorkerRegistry();
      const hubuWorkers = registry.listByMinistry('hubu-search');
      expect(hubuWorkers.length).toBeGreaterThan(0);
      hubuWorkers.forEach(w => expect(w.ministry).toBe('hubu-search'));
    });

    it('enables and disables workers', () => {
      const registry = createDefaultWorkerRegistry();
      const workerId = registry.list()[0].id;
      expect(registry.isEnabled(workerId)).toBe(true);
      registry.setEnabled(workerId, false);
      expect(registry.isEnabled(workerId)).toBe(false);
      registry.setEnabled(workerId, true);
      expect(registry.isEnabled(workerId)).toBe(true);
    });

    it('ignores setEnabled for unknown worker', () => {
      const registry = new WorkerRegistry([]);
      registry.setEnabled('unknown', false);
      expect(registry.isEnabled('unknown')).toBe(true);
    });

    it('defaults to enabled', () => {
      const registry = new WorkerRegistry([]);
      expect(registry.isEnabled('nonexistent')).toBe(true);
    });

    it('selects primary worker for ministry', () => {
      const registry = createDefaultWorkerRegistry();
      const worker = registry.getPrimaryWorker('hubu-search');
      expect(worker).toBeDefined();
      expect(worker!.ministry).toBe('hubu-search');
    });

    it('returns undefined when no workers for ministry', () => {
      const registry = new WorkerRegistry([]);
      expect(registry.getPrimaryWorker('hubu-search')).toBeUndefined();
    });

    it('filters disabled workers from primary selection', () => {
      const registry = createDefaultWorkerRegistry();
      const hubuWorkers = registry.listByMinistry('hubu-search');
      hubuWorkers.forEach(w => registry.setEnabled(w.id, false));
      expect(registry.getPrimaryWorker('hubu-search')).toBeUndefined();
    });

    it('scores installed-skill workers higher', () => {
      const registry = new WorkerRegistry([
        {
          id: 'core-1',
          ministry: 'hubu-search',
          kind: 'core',
          displayName: 'Core',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        },
        {
          id: 'skill-1',
          ministry: 'hubu-search',
          kind: 'installed-skill',
          displayName: 'Skill',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        }
      ]);
      const worker = registry.getPrimaryWorker('hubu-search');
      expect(worker!.id).toBe('skill-1');
    });

    it('scores company workers higher than core', () => {
      const registry = new WorkerRegistry([
        {
          id: 'core-1',
          ministry: 'hubu-search',
          kind: 'core',
          displayName: 'Core',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        },
        {
          id: 'company-1',
          ministry: 'hubu-search',
          kind: 'company',
          displayName: 'Company',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        }
      ]);
      const worker = registry.getPrimaryWorker('hubu-search');
      expect(worker!.id).toBe('company-1');
    });

    it('boosts workers with matching tags', () => {
      const registry = new WorkerRegistry([
        {
          id: 'generic',
          ministry: 'hubu-search',
          kind: 'core',
          displayName: 'Generic',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none',
          tags: ['general']
        },
        {
          id: 'researcher',
          ministry: 'hubu-search',
          kind: 'core',
          displayName: 'Researcher',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none',
          tags: ['research', 'knowledge']
        }
      ]);
      const worker = registry.getPrimaryWorker('hubu-search', 'research knowledge task');
      expect(worker!.id).toBe('researcher');
    });

    it('respects preferredTags constraint', () => {
      const registry = new WorkerRegistry([
        {
          id: 'generic',
          ministry: 'hubu-search',
          kind: 'core',
          displayName: 'Generic',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none',
          tags: ['general']
        },
        {
          id: 'specialist',
          ministry: 'hubu-search',
          kind: 'core',
          displayName: 'Specialist',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none',
          tags: ['research']
        }
      ]);
      const worker = registry.getPrimaryWorker('hubu-search', undefined, { preferredTags: ['research'] });
      expect(worker!.id).toBe('specialist');
    });

    it('respects preferredWorkerIds constraint', () => {
      const registry = new WorkerRegistry([
        {
          id: 'w1',
          ministry: 'hubu-search',
          kind: 'core',
          displayName: 'W1',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        },
        {
          id: 'w2',
          ministry: 'hubu-search',
          kind: 'core',
          displayName: 'W2',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        }
      ]);
      const worker = registry.getPrimaryWorker('hubu-search', undefined, { preferredWorkerIds: ['w2'] });
      expect(worker!.id).toBe('w2');
    });

    it('avoids workers in avoidedWorkerIds', () => {
      const registry = new WorkerRegistry([
        {
          id: 'w1',
          ministry: 'hubu-search',
          kind: 'core',
          displayName: 'W1',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        },
        {
          id: 'w2',
          ministry: 'hubu-search',
          kind: 'core',
          displayName: 'W2',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        }
      ]);
      const worker = registry.getPrimaryWorker('hubu-search', undefined, { avoidedWorkerIds: ['w1'] });
      expect(worker!.id).toBe('w2');
    });

    it('boosts browser workers for browse goal', () => {
      const registry = new WorkerRegistry([
        {
          id: 'generic',
          ministry: 'bingbu-ops',
          kind: 'core',
          displayName: 'Generic',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        },
        {
          id: 'browser-worker',
          ministry: 'bingbu-ops',
          kind: 'core',
          displayName: 'Browser',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        }
      ]);
      const worker = registry.getPrimaryWorker('bingbu-ops', 'browse the website');
      expect(worker!.id).toBe('browser-worker');
    });

    it('boosts ci workers for CI goal', () => {
      const registry = new WorkerRegistry([
        {
          id: 'generic',
          ministry: 'bingbu-ops',
          kind: 'core',
          displayName: 'Generic',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        },
        {
          id: 'ci-worker',
          ministry: 'bingbu-ops',
          kind: 'core',
          displayName: 'CI',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        }
      ]);
      const worker = registry.getPrimaryWorker('bingbu-ops', 'run ci tests');
      expect(worker!.id).toBe('ci-worker');
    });

    it('boosts frontend workers for frontend goal', () => {
      const registry = new WorkerRegistry([
        {
          id: 'generic',
          ministry: 'gongbu-code',
          kind: 'core',
          displayName: 'Generic',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        },
        {
          id: 'frontend-worker',
          ministry: 'gongbu-code',
          kind: 'core',
          displayName: 'Frontend',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        }
      ]);
      const worker = registry.getPrimaryWorker('gongbu-code', 'build frontend react component');
      expect(worker!.id).toBe('frontend-worker');
    });

    it('boosts service workers for service goal', () => {
      const registry = new WorkerRegistry([
        {
          id: 'generic',
          ministry: 'gongbu-code',
          kind: 'core',
          displayName: 'Generic',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        },
        {
          id: 'service-worker',
          ministry: 'gongbu-code',
          kind: 'core',
          displayName: 'Service',
          defaultModel: 'm',
          supportedCapabilities: [],
          reviewPolicy: 'none'
        }
      ]);
      const worker = registry.getPrimaryWorker('gongbu-code', 'build nestjs service');
      expect(worker!.id).toBe('service-worker');
    });
  });

  describe('createDefaultWorkerRegistry', () => {
    it('creates registry with default workers', () => {
      const registry = createDefaultWorkerRegistry();
      expect(registry.list().length).toBeGreaterThan(5);
    });

    it('has core workers for all ministries', () => {
      const registry = createDefaultWorkerRegistry();
      const ministries = [
        'libu-governance',
        'hubu-search',
        'libu-delivery',
        'bingbu-ops',
        'xingbu-review',
        'gongbu-code'
      ];
      for (const ministry of ministries) {
        expect(registry.listByMinistry(ministry as any).length).toBeGreaterThan(0);
      }
    });
  });
});
