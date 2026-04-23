import type { AgentRuntimeContext } from '../runtime/agent-runtime-context';
import { getRuntimeAgentDependencies } from '../contracts/runtime-agent-dependencies';

/**
 * @kernel-boundary Kernel adapter — 只允许通过 getRuntimeAgentDependencies() 转发调用，
 * 禁止在此文件直接 import agents/* 或 @agent/agents-* 等具体 agent 实现。
 * 具体实现由 packages/platform-runtime 通过 RuntimeAgentDependencies 注入。
 */
export const createGongbuCodeMinistry = (context: AgentRuntimeContext) =>
  getRuntimeAgentDependencies().createGongbuCodeMinistry(context);

export const createBingbuOpsMinistry = (context: AgentRuntimeContext) =>
  getRuntimeAgentDependencies().createBingbuOpsMinistry(context);
