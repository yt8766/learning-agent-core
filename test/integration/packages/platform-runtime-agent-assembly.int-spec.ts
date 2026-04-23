/**
 * 第2类 integration：platform-runtime 装配 agent
 *
 * 验证 createOfficialAgentRegistry() 和 createPlatformRuntime() 在无外部服务的情况下
 * 能正确装配四个官方 Agent，并返回结构完整的 PlatformRuntimeFacade。
 *
 * 命名约定：*.int-spec.ts
 */

import { describe, expect, it } from 'vitest';

import {
  OFFICIAL_CODER_AGENT_ID,
  OFFICIAL_CODER_PRIMARY_CAPABILITY,
  OFFICIAL_DATA_REPORT_AGENT_ID,
  OFFICIAL_DATA_REPORT_PRIMARY_CAPABILITY,
  OFFICIAL_REVIEWER_AGENT_ID,
  OFFICIAL_REVIEWER_PRIMARY_CAPABILITY,
  OFFICIAL_SUPERVISOR_AGENT_ID,
  OFFICIAL_SUPERVISOR_PRIMARY_CAPABILITY,
  createOfficialAgentRegistry,
  createOfficialRuntimeAgentDependencies,
  createOfficialWorkflowRegistry,
  listSubgraphDescriptors,
  listWorkflowPresets,
  listWorkflowVersions
} from '@agent/platform-runtime';

import { createPlatformRuntime } from '@agent/platform-runtime';

describe('platform-runtime agent assembly (第2类 integration)', () => {
  describe('createOfficialAgentRegistry()', () => {
    it('returns exactly 4 official agents', () => {
      const registry = createOfficialAgentRegistry();
      const agents = registry.listAgents();
      expect(agents).toHaveLength(4);
    });

    it('includes official.supervisor with orchestrator kind', () => {
      const registry = createOfficialAgentRegistry();
      const provider = registry.findAgentById(OFFICIAL_SUPERVISOR_AGENT_ID);
      expect(provider).toBeDefined();
      expect(provider?.descriptor.id).toBe(OFFICIAL_SUPERVISOR_AGENT_ID);
      expect(provider?.descriptor.kind).toBe('orchestrator');
      expect(provider?.descriptor.source).toBe('official');
    });

    it('includes official.coder with specialist kind', () => {
      const registry = createOfficialAgentRegistry();
      const provider = registry.findAgentById(OFFICIAL_CODER_AGENT_ID);
      expect(provider).toBeDefined();
      expect(provider?.descriptor.kind).toBe('specialist');
      expect(provider?.descriptor.source).toBe('official');
    });

    it('includes official.reviewer with specialist kind', () => {
      const registry = createOfficialAgentRegistry();
      const provider = registry.findAgentById(OFFICIAL_REVIEWER_AGENT_ID);
      expect(provider).toBeDefined();
      expect(provider?.descriptor.kind).toBe('specialist');
    });

    it('includes official.data-report with specialist kind', () => {
      const registry = createOfficialAgentRegistry();
      const provider = registry.findAgentById(OFFICIAL_DATA_REPORT_AGENT_ID);
      expect(provider).toBeDefined();
      expect(provider?.descriptor.kind).toBe('specialist');
    });

    it('resolves supervisor by primary capability (workflow.routing)', () => {
      const registry = createOfficialAgentRegistry();
      const providers = registry.findAgentsByCapability(OFFICIAL_SUPERVISOR_PRIMARY_CAPABILITY);
      expect(providers).toHaveLength(1);
      expect(providers[0]?.descriptor.id).toBe(OFFICIAL_SUPERVISOR_AGENT_ID);
    });

    it('resolves coder by primary capability (execution.code)', () => {
      const registry = createOfficialAgentRegistry();
      const providers = registry.findAgentsByCapability(OFFICIAL_CODER_PRIMARY_CAPABILITY);
      expect(providers).toHaveLength(1);
      expect(providers[0]?.descriptor.id).toBe(OFFICIAL_CODER_AGENT_ID);
    });

    it('resolves reviewer by primary capability (review.quality)', () => {
      const registry = createOfficialAgentRegistry();
      const providers = registry.findAgentsByCapability(OFFICIAL_REVIEWER_PRIMARY_CAPABILITY);
      expect(providers).toHaveLength(1);
      expect(providers[0]?.descriptor.id).toBe(OFFICIAL_REVIEWER_AGENT_ID);
    });

    it('resolves data-report by primary capability (report.generation)', () => {
      const registry = createOfficialAgentRegistry();
      const providers = registry.findAgentsByCapability(OFFICIAL_DATA_REPORT_PRIMARY_CAPABILITY);
      expect(providers).toHaveLength(1);
      expect(providers[0]?.descriptor.id).toBe(OFFICIAL_DATA_REPORT_AGENT_ID);
    });

    it('returns empty array for unknown capability', () => {
      const registry = createOfficialAgentRegistry();
      const providers = registry.findAgentsByCapability('nonexistent.capability');
      expect(providers).toHaveLength(0);
    });

    it('returns undefined for unknown agent id', () => {
      const registry = createOfficialAgentRegistry();
      expect(registry.findAgentById('nonexistent.agent')).toBeUndefined();
    });

    it('instantiates supervisor agent module synchronously', () => {
      const registry = createOfficialAgentRegistry();
      const provider = registry.findAgentById(OFFICIAL_SUPERVISOR_AGENT_ID);
      const agent = provider?.createAgent();
      // createAgent returns an object or Promise — for official agents it's sync
      expect(agent).toBeDefined();
      expect(typeof agent).not.toBe('undefined');
    });

    it('supervisor agent module exposes createMainRouteGraph', async () => {
      const registry = createOfficialAgentRegistry();
      const provider = registry.findAgentById(OFFICIAL_SUPERVISOR_AGENT_ID);
      const agent = await provider?.createAgent();
      expect(agent).toHaveProperty('createMainRouteGraph');
      expect(typeof (agent as Record<string, unknown>)['createMainRouteGraph']).toBe('function');
    });
  });

  describe('createPlatformRuntime()', () => {
    it('assembles facade with runtime, agentRegistry, agentDependencies and metadata', () => {
      const agentRegistry = createOfficialAgentRegistry();
      const agentDependencies = createOfficialRuntimeAgentDependencies({ agentRegistry });

      const facade = createPlatformRuntime({
        runtime: {} as unknown,
        agentRegistry,
        agentDependencies,
        metadata: {
          listWorkflowPresets,
          listSubgraphDescriptors,
          listWorkflowVersions
        }
      });

      expect(facade.runtime).toBeDefined();
      expect(facade.agentRegistry).toBe(agentRegistry);
      expect(facade.agentDependencies).toBe(agentDependencies);
      expect(facade.metadata).toBeDefined();
    });

    it('falls back to official registry when agentRegistry is not provided', () => {
      const facade = createPlatformRuntime({ runtime: {} as unknown });
      expect(facade.agentRegistry).toBeDefined();
      const agents = facade.agentRegistry.listAgents();
      expect(agents.length).toBeGreaterThan(0);
    });

    it('metadata.listWorkflowPresets() returns non-empty list', () => {
      const facade = createPlatformRuntime({ runtime: {} as unknown });
      const presets = facade.metadata.listWorkflowPresets();
      expect(presets.length).toBeGreaterThan(0);
    });

    it('metadata.listSubgraphDescriptors() returns non-empty list', () => {
      const facade = createPlatformRuntime({ runtime: {} as unknown });
      const descriptors = facade.metadata.listSubgraphDescriptors();
      expect(descriptors.length).toBeGreaterThan(0);
    });

    it('metadata.listWorkflowVersions() returns non-empty list', () => {
      const facade = createPlatformRuntime({ runtime: {} as unknown });
      const versions = facade.metadata.listWorkflowVersions();
      expect(versions.length).toBeGreaterThan(0);
    });
  });

  describe('createOfficialWorkflowRegistry()', () => {
    it('returns workflow registry with official presets', () => {
      const workflowRegistry = createOfficialWorkflowRegistry();
      expect(workflowRegistry).toBeDefined();
    });
  });
});
