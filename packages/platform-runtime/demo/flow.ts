import type { ILLMProvider } from '@agent/core';
import type { RuntimeAgentDependencies } from '@agent/runtime';

import { createDefaultPlatformRuntime } from '../src/index.js';

const testLlmProvider: ILLMProvider = {
  providerId: 'test-provider',
  displayName: 'Test Provider',
  supportedModels: () => [],
  isConfigured: () => true,
  generateText: async () => 'ok',
  streamText: async () => 'ok',
  generateObject: async () => ({}) as never
};

const demoAgentDependencies: RuntimeAgentDependencies = {
  createLibuRouterMinistry: () => ({}) as never,
  createHubuSearchMinistry: () => ({}) as never,
  createLibuDocsMinistry: () => ({}) as never,
  createGongbuCodeMinistry: () => ({}) as never,
  createBingbuOpsMinistry: () => ({}) as never,
  createXingbuReviewMinistry: () => ({}) as never,
  listBootstrapSkills: () => [],
  buildResearchSourcePlan: () => [],
  initializeTaskExecutionSteps: () => undefined,
  markExecutionStepBlocked: () => undefined,
  markExecutionStepCompleted: () => undefined,
  markExecutionStepResumed: () => undefined,
  markExecutionStepStarted: () => undefined,
  mergeEvidence: (existing, incoming) => [...existing, ...incoming],
  resolveSpecialistRoute: () => ({
    specialistLead: {
      id: 'technical-architecture',
      displayName: 'Demo Runtime',
      domain: 'technical-architecture'
    },
    supportingSpecialists: [],
    routeConfidence: 0,
    contextSlicesBySpecialist: []
  }),
  resolveWorkflowPreset: goal => ({
    preset: {
      id: 'demo',
      command: '/demo',
      title: 'Demo',
      summary: 'Platform runtime demo preset',
      category: 'general'
    },
    normalizedGoal: goal
  }),
  resolveWorkflowRoute: () => ({
    graph: 'workflow',
    flow: 'supervisor',
    reason: 'demo-runtime',
    adapter: 'demo',
    priority: 0,
    intent: 'workflow-execute',
    intentConfidence: 1,
    executionReadiness: 'ready',
    matchedSignals: ['demo-runtime']
  }),
  runDispatchStage: async () => undefined,
  runGoalIntakeStage: async () => undefined,
  runManagerPlanStage: async () => undefined,
  runRouteStage: async () => undefined,
  buildDataReportContract: () => ({
    scope: 'single',
    templateRef: 'generic-report',
    componentPattern: [],
    implementationNotes: [],
    executionStages: [],
    contextBlock: ''
  }),
  appendDataReportContext: context => context ?? ''
};

const facade = createDefaultPlatformRuntime({
  llmProvider: testLlmProvider,
  agentDependencies: demoAgentDependencies
});

console.log(
  JSON.stringify(
    {
      agentIds: facade.agentRegistry.listAgents().map(agent => agent.id),
      workflowPresetCount: facade.metadata.listWorkflowPresets().length,
      subgraphCount: facade.metadata.listSubgraphDescriptors().length,
      workflowVersionCount: facade.metadata.listWorkflowVersions().length
    },
    null,
    2
  )
);
