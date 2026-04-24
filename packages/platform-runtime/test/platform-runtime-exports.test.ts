import { describe, expect, it } from 'vitest';
import type { ILLMProvider } from '@agent/core';
import type { AgentRegistry } from '@agent/agent-kit';

import {
  StaticAgentRegistry,
  createDefaultPlatformRuntime,
  createDefaultPlatformRuntimeOptions,
  createOfficialAgentRegistry,
  createOfficialRuntimeAgentDependencies,
  createOfficialWorkflowRegistry,
  createPlatformRuntime,
  createRuntimeAgentProvider,
  executeReportBundleEditFlow,
  executeReportBundleGenerateFlow,
  listBootstrapSkills,
  listWorkflowPresets
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
  it('exports the platform assembly facade and registry foundations', () => {
    expect(StaticAgentRegistry).toBeTypeOf('function');
    expect(createPlatformRuntime).toBeTypeOf('function');
    expect(createDefaultPlatformRuntime).toBeTypeOf('function');
    expect(createDefaultPlatformRuntimeOptions).toBeTypeOf('function');
    expect(createOfficialAgentRegistry).toBeTypeOf('function');
    expect(createOfficialRuntimeAgentDependencies).toBeTypeOf('function');
    expect(createOfficialWorkflowRegistry).toBeTypeOf('function');
    expect(createRuntimeAgentProvider).toBeTypeOf('function');
    expect(executeReportBundleGenerateFlow).toBeTypeOf('function');
    expect(executeReportBundleEditFlow).toBeTypeOf('function');
    expect(listBootstrapSkills).toBeTypeOf('function');
    expect(listWorkflowPresets).toBeTypeOf('function');
  });

  it('keeps the root entry focused on assembly exports instead of raw agent package passthrough', () => {
    expect(platformRuntime).not.toHaveProperty('ExecutorAgent');
    expect(platformRuntime).not.toHaveProperty('ReviewerAgent');
    expect(platformRuntime).not.toHaveProperty('DataReportSandpackAgent');
    expect(platformRuntime).not.toHaveProperty('createMainRouteGraph');
  });

  it('creates an injectable platform runtime facade without global registry state', () => {
    const agentDependencies = createOfficialRuntimeAgentDependencies();
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
    expect(facade.metadata.listWorkflowPresets()).toEqual(listWorkflowPresets());
  });

  it('registers official platform agents with capability and domain lookup support', () => {
    const registry = createOfficialAgentRegistry();
    const agents = registry.listAgents();

    expect(agents.map(agent => agent.id)).toEqual([
      'official.supervisor',
      'official.coder',
      'official.reviewer',
      'official.data-report'
    ]);
    expect(
      registry.findAgentsByCapability('specialist.technical-architecture').map(agent => agent.descriptor.id)
    ).toEqual(['official.coder', 'official.reviewer', 'official.data-report']);
    expect(registry.findAgentsByDomain('technical-architecture').map(agent => agent.descriptor.id)).toEqual([
      'official.coder',
      'official.reviewer',
      'official.data-report'
    ]);
    expect(registry.findAgentsByDomain('risk-compliance').map(agent => agent.descriptor.id)).toEqual([
      'official.reviewer'
    ]);
  });

  it('wires the default platform runtime with the official registry instead of an empty fallback', () => {
    const facade = createDefaultPlatformRuntime({
      llmProvider: testLlmProvider
    });

    expect(facade.agentRegistry.listAgents().map(agent => agent.id)).toEqual([
      'official.supervisor',
      'official.coder',
      'official.reviewer',
      'official.data-report'
    ]);
    expect(facade.agentDependencies.resolveWorkflowPreset('请生成一个数据报表').preset.id).toBeDefined();
    expect(facade.metadata.listSubgraphDescriptors().length).toBeGreaterThan(0);
    expect(facade.metadata.listWorkflowVersions().length).toBeGreaterThan(0);
  });

  it('builds reusable default platform runtime options with platform profile and cwd workspace root', () => {
    const options = createDefaultPlatformRuntimeOptions({
      llmProvider: testLlmProvider
    });

    expect(options.profile).toBe('platform');
    expect(options.settingsOptions?.workspaceRoot).toBe(process.cwd());
    expect(options.llmProvider).toBe(testLlmProvider);
  });

  it('enriches runtime specialist routes with official registry agent matches', () => {
    const registry = createOfficialAgentRegistry();
    const dependencies = createOfficialRuntimeAgentDependencies({
      agentRegistry: registry
    });

    const route = dependencies.resolveSpecialistRoute({
      goal: '请帮我重构这个报表 dashboard 的技术架构和实现方案',
      context: '需要明确代码改造路径、review 风险和报表生成边界。'
    });

    expect(route.specialistLead.domain).toBe('technical-architecture');
    expect(route.specialistLead.requiredCapabilities).toEqual(['specialist.technical-architecture']);
    expect(route.specialistLead.agentId).toBe('official.coder');
    expect(route.specialistLead.candidateAgentIds).toEqual([
      'official.coder',
      'official.reviewer',
      'official.data-report'
    ]);
    expect(
      route.supportingSpecialists.every(
        item =>
          (Array.isArray(item.requiredCapabilities) || item.requiredCapabilities === undefined) &&
          (Array.isArray(item.candidateAgentIds) || item.candidateAgentIds === undefined)
      )
    ).toBe(true);
  });

  it('resolves official runtime dependencies from capability descriptors instead of fixed agent ids', () => {
    const registry = new StaticAgentRegistry<any>([
      createRuntimeAgentProvider({
        descriptor: {
          id: 'custom.supervisor-host',
          displayName: 'Custom Supervisor',
          capabilities: ['workflow.routing', 'workflow.planning', 'workflow.dispatch', 'research.sources'],
          source: 'custom'
        },
        createAgent: () => ({
          createMainRouteGraph: () => 'graph',
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
            specialistLead: {
              id: 'technical-architecture',
              displayName: '技术架构专家',
              domain: 'technical-architecture',
              requiredCapabilities: ['specialist.technical-architecture']
            },
            supportingSpecialists: [],
            routeConfidence: 0.9,
            contextSlicesBySpecialist: []
          }),
          runGoalIntakeStage: async () => 'goal-stage',
          runRouteStage: async () => 'route-stage',
          runManagerPlanStage: async () => 'plan-stage',
          runDispatchStage: async () => 'dispatch-stage',
          LibuRouterMinistry: class LibuRouterMinistry {},
          HubuSearchMinistry: class HubuSearchMinistry {},
          LibuDocsMinistry: class LibuDocsMinistry {}
        })
      }),
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
      }),
      createRuntimeAgentProvider({
        descriptor: {
          id: 'custom.review-host',
          displayName: 'Custom Reviewer',
          capabilities: ['review.quality', 'review.risk', 'specialist.risk-compliance'],
          domains: ['risk-compliance'],
          source: 'custom'
        },
        createAgent: () => ({
          ReviewerAgent: class ReviewerAgent {},
          XingbuReviewMinistry: class XingbuReviewMinistry {}
        })
      }),
      createRuntimeAgentProvider({
        descriptor: {
          id: 'custom.report-host',
          displayName: 'Custom Report Agent',
          capabilities: ['report.generation', 'report.preview'],
          domains: ['technical-architecture'],
          source: 'custom'
        },
        createAgent: () => ({
          DataReportSandpackAgent: class DataReportSandpackAgent {},
          createDataReportSandpackGraph: () => 'report-graph',
          buildDataReportContract: () => ({
            scope: 'single',
            templateRef: 'generic-report',
            componentPattern: [],
            implementationNotes: [],
            executionStages: [],
            contextBlock: 'context'
          }),
          appendDataReportContext: (taskContext?: string) => taskContext ?? ''
        })
      })
    ]) as AgentRegistry;

    const dependencies = createOfficialRuntimeAgentDependencies({
      agentRegistry: registry as never
    });

    expect(() => dependencies.createGongbuCodeMinistry({} as never)).not.toThrow();
    expect(() => dependencies.createXingbuReviewMinistry({} as never)).not.toThrow();
    expect(
      dependencies.resolveSpecialistRoute({ goal: '请给我一个技术架构方案' }).specialistLead.requiredCapabilities
    ).toEqual(['specialist.technical-architecture']);
    expect(dependencies.buildDataReportContract('生成报表').templateRef).toBe('generic-report');
  });
});
