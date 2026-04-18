interface AgentErrorTaskLike {
  id: string;
  goal: string;
  status?: string;
  currentNode?: string;
  currentStep?: string;
  currentMinistry?: string;
  currentWorker?: string;
  trace?: Array<{
    node?: string;
    summary?: string;
    at: string;
    data?: Record<string, unknown>;
  }>;
}

export interface AgentErrorInput {
  errorCode: string;
  errorCategory: string;
  ministry: string;
  toolName?: string;
  retryable: boolean;
}

export interface RecentAgentErrorRecord {
  id: string;
  taskId: string;
  goal: string;
  status: string;
  at: string;
  node?: string;
  step?: string;
  ministry?: string;
  worker?: string;
  phase?: string;
  routeFlow?: string;
  errorCode: string;
  errorCategory: string;
  errorName: string;
  message?: string;
  retryable: boolean;
  toolName?: string;
  intent?: string;
  stack?: string;
  diagnosisHint: string;
  recommendedAction: string;
  recoveryPlaybook: string[];
}

export function buildAgentErrorDiagnosisHint(input: AgentErrorInput): string {
  if (input.errorCode === 'provider_transient_error') {
    return '更像是上游模型或外部服务瞬时波动，不一定是业务逻辑本身有问题。';
  }
  if (input.errorCode === 'tool_execution_error') {
    return input.toolName
      ? `重点检查工具 ${input.toolName} 的参数、connector 健康和审批/权限状态。`
      : '重点检查工具调用参数、connector 健康和审批/权限状态。';
  }
  if (input.errorCode === 'approval_flow_error') {
    return '错误发生在审批恢复链路，建议优先检查 pending action、approval 状态和恢复上下文。';
  }
  if (input.errorCode === 'state_transition_error') {
    return '这更像是状态机或节点契约问题，建议检查当前 node 的输入输出与 task state 更新。';
  }
  if (input.ministry === 'hubu-search') {
    return '户部链路报错时，优先检查 research source、web/MCP 检索能力和来源预算。';
  }
  if (input.ministry === 'gongbu-code' || input.ministry === 'bingbu-ops') {
    return '工部/兵部报错时，优先检查工具执行结果、沙箱环境和 connector 可用性。';
  }
  return input.retryable
    ? '当前错误具备重试特征，可先保留上下文后再尝试恢复。'
    : '当前错误更像非瞬时失败，建议先看 trace、stack 和节点契约。';
}

export function buildAgentErrorRecommendedAction(input: AgentErrorInput): string {
  if (input.errorCode === 'provider_transient_error') {
    return '优先重试当前任务；若持续失败，再切换模型或降级到备用 provider。';
  }
  if (input.errorCode === 'tool_execution_error') {
    return input.toolName
      ? `先检查 ${input.toolName} 对应 connector/session，再决定是否重试或改走人工审批。`
      : '先检查相关 connector/session，再决定是否重试或改走人工审批。';
  }
  if (input.errorCode === 'approval_flow_error') {
    return '优先检查审批记录与 pending execution，再从 approval recovery 重新恢复。';
  }
  if (input.errorCode === 'state_transition_error') {
    return '优先修复节点状态更新逻辑，不建议直接无条件重试同一路径。';
  }
  return input.retryable
    ? '建议先重试一次，并保留当前 task trace 供刑部诊断。'
    : '建议先转人工排查，再考虑是否重新执行。';
}

export function buildAgentErrorRecoveryPlaybook(input: AgentErrorInput): string[] {
  if (input.errorCode === 'provider_transient_error') {
    return [
      '先刷新运行态，确认是否为短时 provider 波动。',
      '重试当前任务一次，观察错误是否自动恢复。',
      '若仍失败，切换模型或启用备用 provider。'
    ];
  }
  if (input.errorCode === 'tool_execution_error') {
    return [
      input.toolName ? `检查 ${input.toolName} 的 connector/session 健康。` : '检查相关工具的 connector/session 健康。',
      '确认审批状态、权限和输入参数是否完整。',
      '必要时转人工诊断，再决定是否重试。'
    ];
  }
  if (input.errorCode === 'approval_flow_error') {
    return [
      '检查 pending action 与 approval 记录。',
      '确认恢复上下文没有丢失。',
      '从 approval recovery 重新恢复一次。'
    ];
  }
  if (input.errorCode === 'state_transition_error') {
    return ['先查看最近 trace 与 stack。', '检查当前节点输入输出契约。', '修复状态更新逻辑后再重新执行任务。'];
  }
  if (input.ministry === 'hubu-search') {
    return [
      '检查 research source 与来源预算。',
      '确认搜索/阅读 connector 是否健康。',
      '必要时切换到受控来源或减少来源范围。'
    ];
  }
  return input.retryable
    ? ['刷新运行态确认错误仍存在。', '重试当前任务。', '若再次失败，创建诊断任务交给刑部/首辅分析。']
    : [
        '查看最近 trace、stack 和错误分类。',
        '创建诊断任务，让首辅按当前上下文生成修复建议。',
        '确认后再决定是否重试。'
      ];
}

export function deriveRecentAgentErrors(tasks: AgentErrorTaskLike[], limit = 8): RecentAgentErrorRecord[] {
  return tasks
    .flatMap(task =>
      (task.trace ?? [])
        .filter(trace => trace.node === 'agent_error')
        .map(trace => {
          const detail = (trace.data ?? {}) as Record<string, unknown>;
          const input: AgentErrorInput = {
            errorCode: typeof detail.errorCode === 'string' ? detail.errorCode : 'agent_runtime_error',
            errorCategory: typeof detail.errorCategory === 'string' ? detail.errorCategory : 'runtime',
            ministry: typeof detail.ministry === 'string' ? detail.ministry : String(task.currentMinistry ?? ''),
            toolName: typeof detail.toolName === 'string' ? detail.toolName : undefined,
            retryable: Boolean(detail.retryable)
          };
          return {
            id: `${task.id}:${trace.at}:agent_error`,
            taskId: task.id,
            goal: task.goal,
            status: String(task.status),
            at: trace.at,
            node: typeof detail.node === 'string' ? detail.node : task.currentNode,
            step: typeof detail.step === 'string' ? detail.step : task.currentStep,
            ministry: typeof detail.ministry === 'string' ? detail.ministry : task.currentMinistry,
            worker: typeof detail.worker === 'string' ? detail.worker : task.currentWorker,
            phase: typeof detail.phase === 'string' ? detail.phase : undefined,
            routeFlow: typeof detail.routeFlow === 'string' ? detail.routeFlow : undefined,
            errorCode: input.errorCode,
            errorCategory: input.errorCategory,
            errorName: typeof detail.errorName === 'string' ? detail.errorName : 'UnknownError',
            message: typeof detail.errorMessage === 'string' ? detail.errorMessage : trace.summary,
            retryable: input.retryable,
            toolName: input.toolName,
            intent: typeof detail.intent === 'string' ? detail.intent : undefined,
            stack: typeof detail.stack === 'string' ? detail.stack : undefined,
            diagnosisHint: buildAgentErrorDiagnosisHint(input),
            recommendedAction: buildAgentErrorRecommendedAction(input),
            recoveryPlaybook: buildAgentErrorRecoveryPlaybook(input)
          };
        })
    )
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, limit);
}
