import type { AgentRuntimeContext } from '../runtime/agent-runtime-context';
import { getRuntimeAgentDependencies } from '../contracts/runtime-agent-dependencies';

// Runtime-internal adapter for reviewer-side capabilities wired by the composition root.
export const createXingbuReviewMinistry = (context: AgentRuntimeContext) =>
  getRuntimeAgentDependencies().createXingbuReviewMinistry(context);
