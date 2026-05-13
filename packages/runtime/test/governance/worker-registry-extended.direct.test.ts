import { describe, expect, it } from 'vitest';

import { WorkerRegistry } from '../../src/governance/worker-registry';

function makeWorker(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-worker',
    ministry: 'gongbu-code',
    kind: 'core',
    displayName: 'Test Worker',
    defaultModel: 'glm-4.6',
    supportedCapabilities: ['code-generation'],
    reviewPolicy: 'none',
    tags: ['code'],
    ...overrides
  } as any;
}

describe('WorkerRegistry extended (direct)', () => {
  describe('getPrimaryWorker', () => {
    it('returns best worker by tag match', () => {
      const registry = new WorkerRegistry([
        makeWorker({ id: 'w1', tags: ['code'] }),
        makeWorker({ id: 'w2', tags: ['research'] })
      ]);
      const result = registry.getPrimaryWorker('gongbu-code', 'I need code generation');
      expect(result).toBeDefined();
      expect(result!.id).toBe('w1');
    });

    it('prefers company workers over core', () => {
      const registry = new WorkerRegistry([
        makeWorker({ id: 'core-1', kind: 'core', tags: ['general'] }),
        makeWorker({ id: 'company-1', kind: 'company', tags: ['general'] })
      ]);
      const result = registry.getPrimaryWorker('gongbu-code', 'general task');
      expect(result!.id).toBe('company-1');
    });

    it('prefers installed-skill workers', () => {
      const registry = new WorkerRegistry([
        makeWorker({ id: 'core-1', kind: 'core', tags: ['general'] }),
        makeWorker({ id: 'skill-1', kind: 'installed-skill', tags: ['general'] })
      ]);
      const result = registry.getPrimaryWorker('gongbu-code', 'general task');
      expect(result!.id).toBe('skill-1');
    });

    it('returns undefined when no workers for ministry', () => {
      const registry = new WorkerRegistry([makeWorker({ ministry: 'gongbu-code' })]);
      expect(registry.getPrimaryWorker('hubu-search')).toBeUndefined();
    });

    it('excludes disabled workers', () => {
      const registry = new WorkerRegistry([makeWorker({ id: 'w1' })]);
      registry.setEnabled('w1', false);
      expect(registry.getPrimaryWorker('gongbu-code')).toBeUndefined();
    });

    it('excludes workers with disallowed connectors', () => {
      const registry = new WorkerRegistry([makeWorker({ id: 'w1', requiredConnectors: ['repo'] })]);
      const result = registry.getPrimaryWorker('gongbu-code', undefined, {
        disallowedConnectorIds: ['repo']
      });
      expect(result).toBeUndefined();
    });

    it('excludes workers with disallowed profile', () => {
      const registry = new WorkerRegistry([
        makeWorker({ id: 'w1', kind: 'company', requiredConnectors: ['internal-knowledge-base'] })
      ]);
      const result = registry.getPrimaryWorker('gongbu-code', undefined, {
        profile: 'personal'
      });
      expect(result).toBeUndefined();
    });

    it('scores workers by preferred tags', () => {
      const registry = new WorkerRegistry([
        makeWorker({ id: 'w1', tags: ['frontend', 'react'] }),
        makeWorker({ id: 'w2', tags: ['backend'] })
      ]);
      const result = registry.getPrimaryWorker('gongbu-code', undefined, {
        preferredTags: ['react']
      });
      expect(result!.id).toBe('w1');
    });

    it('scores workers by preferred connector tags', () => {
      const registry = new WorkerRegistry([
        makeWorker({ id: 'w1', requiredConnectors: ['github-mcp-template'] }),
        makeWorker({ id: 'w2', requiredConnectors: ['lark-mcp-template'] })
      ]);
      const result = registry.getPrimaryWorker('gongbu-code', undefined, {
        preferredConnectorTags: ['github']
      });
      expect(result!.id).toBe('w1');
    });

    it('boosts preferred worker ids', () => {
      const registry = new WorkerRegistry([
        makeWorker({ id: 'preferred-1', tags: ['code'] }),
        makeWorker({ id: 'other-1', tags: ['code'] })
      ]);
      const result = registry.getPrimaryWorker('gongbu-code', undefined, {
        preferredWorkerIds: ['preferred-1']
      });
      expect(result!.id).toBe('preferred-1');
    });

    it('penalizes avoided worker ids', () => {
      const registry = new WorkerRegistry([
        makeWorker({ id: 'avoid-1', tags: ['code'] }),
        makeWorker({ id: 'good-1', tags: ['code'] })
      ]);
      const result = registry.getPrimaryWorker('gongbu-code', undefined, {
        avoidedWorkerIds: ['avoid-1']
      });
      expect(result!.id).toBe('good-1');
    });

    it('penalizes avoided tags', () => {
      const registry = new WorkerRegistry([
        makeWorker({ id: 'w1', tags: ['experimental', 'code'] }),
        makeWorker({ id: 'w2', tags: ['stable', 'code'] })
      ]);
      const result = registry.getPrimaryWorker('gongbu-code', undefined, {
        avoidedTags: ['experimental']
      });
      expect(result!.id).toBe('w2');
    });

    it('matches preferredContexts in goal', () => {
      const registry = new WorkerRegistry([
        makeWorker({ id: 'w1', preferredContexts: ['code-generation'], tags: [] }),
        makeWorker({ id: 'w2', tags: [] })
      ]);
      const result = registry.getPrimaryWorker('gongbu-code', 'help with code-generation task');
      expect(result!.id).toBe('w1');
    });

    it('matches requiredConnectors in goal', () => {
      const registry = new WorkerRegistry([
        makeWorker({ id: 'w1', requiredConnectors: ['github'], tags: [] }),
        makeWorker({ id: 'w2', tags: [] })
      ]);
      const result = registry.getPrimaryWorker('gongbu-code', 'use github to check');
      expect(result!.id).toBe('w1');
    });

    it('boosts browser workers for browse goals', () => {
      const registry = new WorkerRegistry([
        makeWorker({ id: 'bingbu-ops-browser-1', ministry: 'bingbu-ops', tags: [] }),
        makeWorker({ id: 'other-1', ministry: 'bingbu-ops', tags: [] })
      ]);
      const result = registry.getPrimaryWorker('bingbu-ops', 'browse website');
      expect(result!.id).toBe('bingbu-ops-browser-1');
    });

    it('boosts ci workers for ci goals', () => {
      const registry = new WorkerRegistry([
        makeWorker({ id: 'bingbu-ops-ci-1', ministry: 'bingbu-ops', tags: [] }),
        makeWorker({ id: 'other-1', ministry: 'bingbu-ops', tags: [] })
      ]);
      const result = registry.getPrimaryWorker('bingbu-ops', 'run ci tests');
      expect(result!.id).toBe('bingbu-ops-ci-1');
    });

    it('boosts frontend workers for frontend goals', () => {
      const registry = new WorkerRegistry([
        makeWorker({ id: 'gongbu-code-frontend-1', ministry: 'gongbu-code', tags: [] }),
        makeWorker({ id: 'other-1', ministry: 'gongbu-code', tags: [] })
      ]);
      const result = registry.getPrimaryWorker('gongbu-code', 'build frontend react component');
      expect(result!.id).toBe('gongbu-code-frontend-1');
    });

    it('boosts service workers for service goals', () => {
      const registry = new WorkerRegistry([
        makeWorker({ id: 'gongbu-code-service-1', ministry: 'gongbu-code', tags: [] }),
        makeWorker({ id: 'other-1', ministry: 'gongbu-code', tags: [] })
      ]);
      const result = registry.getPrimaryWorker('gongbu-code', 'build service with nestjs');
      expect(result!.id).toBe('gongbu-code-service-1');
    });
  });

  describe('registerMany', () => {
    it('registers multiple workers', () => {
      const registry = new WorkerRegistry([]);
      registry.registerMany([makeWorker({ id: 'w1' }), makeWorker({ id: 'w2' })]);
      expect(registry.get('w1')).toBeDefined();
      expect(registry.get('w2')).toBeDefined();
    });
  });

  describe('setEnabled', () => {
    it('re-enables a disabled worker', () => {
      const registry = new WorkerRegistry([makeWorker({ id: 'w1' })]);
      registry.setEnabled('w1', false);
      expect(registry.isEnabled('w1')).toBe(false);
      registry.setEnabled('w1', true);
      expect(registry.isEnabled('w1')).toBe(true);
    });

    it('does nothing for non-existent worker', () => {
      const registry = new WorkerRegistry([]);
      registry.setEnabled('nonexistent', false);
    });
  });

  describe('listByMinistry', () => {
    it('filters by ministry', () => {
      const registry = new WorkerRegistry([
        makeWorker({ id: 'w1', ministry: 'gongbu-code' }),
        makeWorker({ id: 'w2', ministry: 'hubu-search' }),
        makeWorker({ id: 'w3', ministry: 'gongbu-code' })
      ]);
      expect(registry.listByMinistry('gongbu-code')).toHaveLength(2);
    });
  });
});
