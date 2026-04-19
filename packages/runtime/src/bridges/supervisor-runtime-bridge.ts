import {
  getRuntimeAgentDependencies,
  type BootstrapSkillRecord,
  type RuntimeAgentDependencies
} from '../contracts/runtime-agent-dependencies';
import type { AgentRuntimeContext } from '../runtime/agent-runtime-context';

// Runtime-internal adapter for supervisor-side capabilities wired by the composition root.
export type { BootstrapSkillRecord };

export const createLibuRouterMinistry = (context: AgentRuntimeContext) =>
  getRuntimeAgentDependencies().createLibuRouterMinistry(context);
export const createHubuSearchMinistry = (context: AgentRuntimeContext) =>
  getRuntimeAgentDependencies().createHubuSearchMinistry(context);
export const createLibuDocsMinistry = (context: AgentRuntimeContext) =>
  getRuntimeAgentDependencies().createLibuDocsMinistry(context);
export const listBootstrapSkills = () => getRuntimeAgentDependencies().listBootstrapSkills();
export const buildResearchSourcePlan = (...args: Parameters<RuntimeAgentDependencies['buildResearchSourcePlan']>) =>
  getRuntimeAgentDependencies().buildResearchSourcePlan(...args);
export const initializeTaskExecutionSteps = (
  ...args: Parameters<RuntimeAgentDependencies['initializeTaskExecutionSteps']>
) => getRuntimeAgentDependencies().initializeTaskExecutionSteps(...args);
export const markExecutionStepBlocked = (...args: Parameters<RuntimeAgentDependencies['markExecutionStepBlocked']>) =>
  getRuntimeAgentDependencies().markExecutionStepBlocked(...args);
export const markExecutionStepCompleted = (
  ...args: Parameters<RuntimeAgentDependencies['markExecutionStepCompleted']>
) => getRuntimeAgentDependencies().markExecutionStepCompleted(...args);
export const markExecutionStepResumed = (...args: Parameters<RuntimeAgentDependencies['markExecutionStepResumed']>) =>
  getRuntimeAgentDependencies().markExecutionStepResumed(...args);
export const markExecutionStepStarted = (...args: Parameters<RuntimeAgentDependencies['markExecutionStepStarted']>) =>
  getRuntimeAgentDependencies().markExecutionStepStarted(...args);
export const mergeEvidence = (...args: Parameters<RuntimeAgentDependencies['mergeEvidence']>) =>
  getRuntimeAgentDependencies().mergeEvidence(...args);
export const resolveSpecialistRoute = (...args: Parameters<RuntimeAgentDependencies['resolveSpecialistRoute']>) =>
  getRuntimeAgentDependencies().resolveSpecialistRoute(...args);
export const resolveWorkflowPreset = (...args: Parameters<RuntimeAgentDependencies['resolveWorkflowPreset']>) =>
  getRuntimeAgentDependencies().resolveWorkflowPreset(...args);
export const resolveWorkflowRoute = (...args: Parameters<RuntimeAgentDependencies['resolveWorkflowRoute']>) =>
  getRuntimeAgentDependencies().resolveWorkflowRoute(...args);
export const runDispatchStage = (...args: Parameters<RuntimeAgentDependencies['runDispatchStage']>) =>
  getRuntimeAgentDependencies().runDispatchStage(...args);
export const runGoalIntakeStage = (...args: Parameters<RuntimeAgentDependencies['runGoalIntakeStage']>) =>
  getRuntimeAgentDependencies().runGoalIntakeStage(...args);
export const runManagerPlanStage = (...args: Parameters<RuntimeAgentDependencies['runManagerPlanStage']>) =>
  getRuntimeAgentDependencies().runManagerPlanStage(...args);
export const runRouteStage = (...args: Parameters<RuntimeAgentDependencies['runRouteStage']>) =>
  getRuntimeAgentDependencies().runRouteStage(...args);
