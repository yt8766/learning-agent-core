import {
  StaticAgentRegistry,
  buildRuntimeCenterProjection,
  buildRuntimeCenterSummaryProjection,
  createDefaultPlatformRuntime,
  createDefaultPlatformRuntimeOptions,
  createOfficialAgentRegistry,
  createOfficialRuntimeAgentDependencies,
  createOfficialWorkflowRegistry,
  createPlatformRuntime,
  createRuntimeAgentProvider,
  listBootstrapSkills,
  listWorkflowPresets,
  toCritiqueStyleReviewOutcome
} from '../src/index.js';
import * as adapterExports from '../src/adapters/index.js';
import * as centersExports from '../src/centers/index.js';
import * as registryExports from '../src/registries/index.js';
import * as runtimeExports from '../src/runtime/index.js';

console.log(
  JSON.stringify(
    {
      runtimeAligned:
        createPlatformRuntime === runtimeExports.createPlatformRuntime &&
        createDefaultPlatformRuntime === runtimeExports.createDefaultPlatformRuntime &&
        createDefaultPlatformRuntimeOptions === runtimeExports.createDefaultPlatformRuntimeOptions,
      registryAligned:
        StaticAgentRegistry === registryExports.StaticAgentRegistry &&
        createOfficialAgentRegistry === registryExports.createOfficialAgentRegistry &&
        createOfficialRuntimeAgentDependencies === registryExports.createOfficialRuntimeAgentDependencies &&
        createOfficialWorkflowRegistry === registryExports.createOfficialWorkflowRegistry &&
        listBootstrapSkills === registryExports.listBootstrapSkills &&
        listWorkflowPresets === registryExports.listWorkflowPresets,
      adapterAligned: createRuntimeAgentProvider === adapterExports.createRuntimeAgentProvider,
      centersAligned:
        buildRuntimeCenterProjection === centersExports.buildRuntimeCenterProjection &&
        buildRuntimeCenterSummaryProjection === centersExports.buildRuntimeCenterSummaryProjection &&
        toCritiqueStyleReviewOutcome === centersExports.toCritiqueStyleReviewOutcome,
      legacyBlockedDecision: toCritiqueStyleReviewOutcome({ decision: 'blocked', summary: 'blocked' }).decision,
      legacyApprovedDecision: toCritiqueStyleReviewOutcome({ decision: 'approved', summary: 'approved' }).decision
    },
    null,
    2
  )
);
