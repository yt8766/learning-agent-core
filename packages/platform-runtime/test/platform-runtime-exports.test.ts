import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import type { ILLMProvider } from '@agent/core';
import type { RuntimeAgentDependencies } from '@agent/runtime';

import {
  StaticAgentRegistry,
  createDefaultPlatformRuntimeOptions,
  createPlatformWorkflowRegistry,
  createPlatformRuntime,
  createRuntimeAgentProvider
} from '../src';
import * as platformRuntime from '../src';

const testLlmProvider: ILLMProvider = {
  providerId: 'test-provider',
  displayName: 'Test Provider',
  supportedModels: () => [],
  isConfigured: () => true,
  generateText: async () => 'ok',
  streamText: async () => 'ok',
  generateObject: async () => ({}) as never
};

describe('@agent/platform-runtime', () => {
  it('depends on runtime for canonical agent and media contracts', () => {
    const platformRuntimePackage = JSON.parse(
      readFileSync(join(process.cwd(), 'packages/platform-runtime/package.json'), 'utf8')
    ) as {
      dependencies?: Record<string, string>;
    };
    const legacyAgentKitPackageName = `@agent/${['agent', 'kit'].join('-')}`;

    expect(platformRuntimePackage.dependencies).toHaveProperty('@agent/runtime');
    expect(platformRuntimePackage.dependencies).not.toHaveProperty(legacyAgentKitPackageName);
  });

  it('exports the platform assembly facade and registry foundations', () => {
    expect(StaticAgentRegistry).toBeTypeOf('function');
    expect(createPlatformRuntime).toBeTypeOf('function');
    expect(createDefaultPlatformRuntimeOptions).toBeTypeOf('function');
    expect(createPlatformWorkflowRegistry).toBeTypeOf('function');
    expect(createRuntimeAgentProvider).toBeTypeOf('function');
  });

  it('keeps the root entry focused on assembly exports instead of raw agent package passthrough', () => {
    expect(platformRuntime).not.toHaveProperty('ExecutorAgent');
    expect(platformRuntime).not.toHaveProperty('ReviewerAgent');
    expect(platformRuntime).not.toHaveProperty('DataReportSandpackAgent');
    expect(platformRuntime).not.toHaveProperty('createMainRouteGraph');
  });

  it('creates an injectable platform runtime facade without global registry state', () => {
    const agentDependencies = {
      listBootstrapSkills: () => [],
      buildResearchSourcePlan: () => [],
      initializeTaskExecutionSteps: () => undefined,
      markExecutionStepBlocked: () => undefined,
      markExecutionStepCompleted: () => undefined,
      markExecutionStepResumed: () => undefined,
      markExecutionStepStarted: () => undefined,
      mergeEvidence: (existing: unknown[]) => existing,
      resolveWorkflowPreset: (goal: string) => ({
        preset: { id: 'custom', command: '/custom', title: 'Custom', summary: 'summary', category: 'general' },
        normalizedGoal: goal
      }),
      resolveWorkflowRoute: () => ({
        graph: 'workflow',
        flow: 'supervisor',
        reason: 'custom',
        adapter: 'custom',
        priority: 100,
        intent: 'workflow-execute',
        intentConfidence: 1,
        executionReadiness: 'ready',
        matchedSignals: ['custom']
      }),
      resolveSpecialistRoute: () => ({
        specialistLead: { id: 'technical-architecture', displayName: '技术架构专家', domain: 'technical-architecture' },
        supportingSpecialists: [],
        routeConfidence: 0.9,
        contextSlicesBySpecialist: []
      }),
      runDispatchStage: async () => 'dispatch-stage',
      runGoalIntakeStage: async () => 'goal-stage',
      runManagerPlanStage: async () => 'plan-stage',
      runRouteStage: async () => 'route-stage',
      buildDataReportContract: () => ({
        scope: 'single',
        templateRef: 'generic-report',
        componentPattern: [],
        implementationNotes: [],
        executionStages: [],
        contextBlock: 'context'
      }),
      appendDataReportContext: (taskContext?: string) => taskContext ?? '',
      createLibuRouterMinistry: () => ({}),
      createHubuSearchMinistry: () => ({}),
      createLibuDocsMinistry: () => ({}),
      createGongbuCodeMinistry: () => ({}),
      createBingbuOpsMinistry: () => ({}),
      createXingbuReviewMinistry: () => ({})
    } as unknown as RuntimeAgentDependencies;
    const provider = createRuntimeAgentProvider({
      descriptor: {
        id: 'test-agent',
        displayName: 'Test Agent',
        capabilities: ['test.capability'],
        source: 'custom'
      },
      createAgent: () => ({ ok: true })
    });
    const agentRegistry = new StaticAgentRegistry([provider]);
    const facade = createPlatformRuntime({
      runtime: { name: 'runtime-kernel' },
      agentRegistry,
      agentDependencies
    });

    expect(facade.runtime).toEqual({ name: 'runtime-kernel' });
    expect(facade.agentRegistry.findAgentById('test-agent')).toBe(provider);
    expect(facade.agentRegistry.findAgentsByCapability('test.capability')).toEqual([provider]);
    expect(facade.agentDependencies).toBe(agentDependencies);
    expect(facade.metadata.listWorkflowPresets()).toEqual([]);
  });

  it('builds reusable default platform runtime options with platform profile and cwd workspace root', () => {
    const options = createDefaultPlatformRuntimeOptions({
      llmProvider: testLlmProvider
    });

    expect(options.profile).toBe('platform');
    expect(options.settingsOptions?.workspaceRoot).toBe(process.cwd());
    expect(options.llmProvider).toBe(testLlmProvider);
  });

  it('supports injected custom agent registries by capability and domain', () => {
    const registry = new StaticAgentRegistry<any>([
      createRuntimeAgentProvider({
        descriptor: {
          id: 'custom.executor-host',
          displayName: 'Custom Coder',
          capabilities: ['execution.code', 'execution.ops', 'specialist.technical-architecture'],
          domains: ['technical-architecture'],
          source: 'custom'
        },
        createAgent: () => ({
          ExecutorAgent: class ExecutorAgent {},
          GongbuCodeMinistry: class GongbuCodeMinistry {},
          BingbuOpsMinistry: class BingbuOpsMinistry {}
        })
      })
    ]);

    expect(registry.findAgentsByCapability('execution.code').map(agent => agent.descriptor.id)).toEqual([
      'custom.executor-host'
    ]);
    expect(registry.findAgentsByDomain('technical-architecture').map(agent => agent.descriptor.id)).toEqual([
      'custom.executor-host'
    ]);
  });
});
