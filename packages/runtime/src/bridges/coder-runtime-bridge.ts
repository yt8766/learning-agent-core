import type { AgentRuntimeContext } from '../runtime/agent-runtime-context';
import { getRuntimeAgentDependencies } from '../contracts/runtime-agent-dependencies';

// Runtime-internal adapter for coder-side capabilities wired by the composition root.
export const createGongbuCodeMinistry = (context: AgentRuntimeContext) =>
  getRuntimeAgentDependencies().createGongbuCodeMinistry(context);

export const createBingbuOpsMinistry = (context: AgentRuntimeContext) =>
  getRuntimeAgentDependencies().createBingbuOpsMinistry(context);
