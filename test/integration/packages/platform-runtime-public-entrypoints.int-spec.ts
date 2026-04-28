import { describe, expect, it } from 'vitest';
import type { ILLMProvider } from '@agent/core';

import { TaskStatusSchema, WorkflowPresetDefinitionSchema, WorkflowVersionRecordSchema } from '@agent/core';
import { AgentRuntime, getRuntimeAgentDependencies } from '@agent/runtime';
import { createDefaultPlatformRuntime, createPlatformRuntime } from '@agent/platform-runtime';
import {
  OFFICIAL_SUPERVISOR_AGENT_ID,
  createOfficialAgentRegistry,
  listSubgraphDescriptors,
  listWorkflowPresets,
  listWorkflowVersions
} from '../../../apps/backend/agent-server/src/runtime/agents';
import { createOfficialRuntimeAgentDependencies } from '../../../apps/backend/agent-server/src/runtime/agents/official-runtime-agent-dependencies';

const testLlmProvider: ILLMProvider = {
  providerId: 'workspace-integration-provider',
  displayName: 'Workspace Integration Provider',
  supportedModels: () => [],
  isConfigured: () => true,
  generateText: async () => 'ok',
  streamText: async () => 'ok',
  generateObject: async () => ({}) as never
};

describe('platform runtime public entrypoint integration', () => {
  it('wires the default platform facade into runtime dependencies and core metadata schemas', () => {
    const agentRegistry = createOfficialAgentRegistry();
    const agentDependencies = createOfficialRuntimeAgentDependencies({ agentRegistry });
    const facade = createDefaultPlatformRuntime({
      llmProvider: testLlmProvider,
      agentRegistry,
      agentDependencies,
      metadata: {
        listWorkflowPresets,
        listSubgraphDescriptors,
        listWorkflowVersions
      }
    });

    const workflowPreset = facade.agentDependencies.resolveWorkflowPreset('请安排一个代码实现任务').preset;
    const workflowVersion = facade.metadata.listWorkflowVersions()[0];
    const specialistRoute = facade.agentDependencies.resolveSpecialistRoute({
      goal: '实现 runtime graph 入口并补 review',
      context: '需要工部实现与刑部复核协作。',
      requestedHints: {
        requestedSpecialist: 'technical-architecture'
      }
    });

    expect(facade.runtime).toBeInstanceOf(AgentRuntime);
    expect(getRuntimeAgentDependencies()).toBe(facade.agentDependencies);
    expect(() => WorkflowPresetDefinitionSchema.parse(workflowPreset)).not.toThrow();
    expect(() => WorkflowVersionRecordSchema.parse(workflowVersion)).not.toThrow();
    expect(TaskStatusSchema.parse('waiting_approval')).toBe('waiting_approval');
    expect(specialistRoute.specialistLead.agentId).toBeDefined();
    expect(specialistRoute.specialistLead.candidateAgentIds?.length).toBeGreaterThan(0);
  });

  it('keeps custom platform facades compatible with official runtime agent dependencies', async () => {
    const agentRegistry = createOfficialAgentRegistry();
    const agentDependencies = createOfficialRuntimeAgentDependencies({ agentRegistry });
    const facade = createPlatformRuntime({
      runtime: { name: 'custom-runtime-kernel' },
      agentRegistry,
      agentDependencies,
      metadata: {
        listWorkflowPresets,
        listSubgraphDescriptors,
        listWorkflowVersions
      }
    });
    const supervisor = facade.agentRegistry.findAgentById(OFFICIAL_SUPERVISOR_AGENT_ID);
    const supervisorModule = await supervisor?.createAgent();
    const resolvedPreset = facade.agentDependencies.resolveWorkflowPreset('/general').preset;

    expect(facade.runtime).toEqual({ name: 'custom-runtime-kernel' });
    expect(supervisor?.descriptor.kind).toBe('orchestrator');
    expect(supervisorModule).toHaveProperty('createMainRouteGraph');
    expect(() => WorkflowPresetDefinitionSchema.parse(resolvedPreset)).not.toThrow();
    expect(facade.metadata.listSubgraphDescriptors().some(item => item.id === 'research')).toBe(true);
  });
});
