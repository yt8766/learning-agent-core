// Legacy execution mode aliases are normalized into canonical executionPlan.mode values here.
export function getMinistryDisplayName(ministry?: string): string | undefined {
  switch (ministry) {
    case 'libu-governance':
    case 'libu-router':
      return '吏部';
    case 'hubu-search':
      return '户部';
    case 'gongbu-code':
      return '工部';
    case 'bingbu-ops':
      return '兵部';
    case 'xingbu-review':
      return '刑部';
    case 'libu-delivery':
    case 'libu-docs':
      return '礼部';
    default:
      return ministry;
  }
}

export function normalizeExecutionMode(mode?: string): 'plan' | 'execute' | 'imperial_direct' | undefined {
  if (!mode) {
    return undefined;
  }
  if (mode === 'planning-readonly') {
    return 'plan';
  }
  if (mode === 'standard') {
    return 'execute';
  }
  if (mode === 'plan' || mode === 'execute' || mode === 'imperial_direct') {
    return mode;
  }
  return undefined;
}

export function getExecutionModeDisplayName(mode?: string): string | undefined {
  switch (normalizeExecutionMode(mode)) {
    case 'plan':
      return '计划模式';
    case 'execute':
      return '执行模式';
    case 'imperial_direct':
      return '特旨直达';
    default:
      return mode;
  }
}

export function getMainChainNodeLabel(node?: string): string | undefined {
  switch (node) {
    case 'entry_router':
      return '通政司';
    case 'mode_gate':
      return '模式门';
    case 'dispatch_planner':
      return '票拟调度器';
    case 'context_filter':
      return '文书科';
    case 'result_aggregator':
      return '汇总票拟';
    case 'interrupt_controller':
      return '司礼监';
    case 'learning_recorder':
      return '实录修纂';
    default:
      return node;
  }
}
