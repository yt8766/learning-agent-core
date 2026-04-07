// Legacy execution mode aliases are normalized into canonical executionPlan.mode values here.
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

export function isLegacyExecutionModeAlias(mode?: string): boolean {
  return mode === 'planning-readonly' || mode === 'standard';
}

export function getExecutionModeDisplayName(mode?: string): string | undefined {
  const normalized = normalizeExecutionMode(mode);
  switch (normalized) {
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

export function getMinistryDisplayName(ministry?: string): string | undefined {
  switch (ministry) {
    case 'libu-governance':
    case 'libu-router':
    case 'libu':
      return '吏部';
    case 'hubu-search':
    case 'hubu':
      return '户部';
    case 'gongbu-code':
    case 'gongbu':
      return '工部';
    case 'bingbu-ops':
    case 'bingbu':
      return '兵部';
    case 'xingbu-review':
    case 'xingbu':
      return '刑部';
    case 'libu-delivery':
    case 'libu-docs':
    case 'libu_docs':
      return '礼部';
    default:
      return ministry;
  }
}
