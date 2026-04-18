const MINISTRY_ALIAS_MAP = {
  'libu-governance': 'libu-governance',
  'libu-router': 'libu-governance',
  'hubu-search': 'hubu-search',
  'gongbu-code': 'gongbu-code',
  'bingbu-ops': 'bingbu-ops',
  'xingbu-review': 'xingbu-review',
  'libu-delivery': 'libu-delivery',
  'libu-docs': 'libu-delivery'
} as const;

const SPECIALIST_ALIAS_MAP = {
  'general-assistant': 'general-assistant',
  'product-strategy': 'product-strategy',
  'growth-marketing': 'growth-marketing',
  'payment-channel': 'payment-channel',
  'risk-compliance': 'risk-compliance',
  'technical-architecture': 'technical-architecture',
  'live-ops': 'growth-marketing'
} as const;

const MINISTRY_LABELS = {
  'libu-governance': '吏部',
  'hubu-search': '户部',
  'gongbu-code': '工部',
  'bingbu-ops': '兵部',
  'xingbu-review': '刑部',
  'libu-delivery': '礼部'
} as const;

const SPECIALIST_LABELS = {
  'general-assistant': '通才阁臣',
  'product-strategy': '产品策略阁臣',
  'growth-marketing': '增长营销阁臣',
  'payment-channel': '支付通道阁臣',
  'risk-compliance': '风控合规阁臣',
  'technical-architecture': '技术架构阁臣'
} as const;

type MinistryId = keyof typeof MINISTRY_ALIAS_MAP;
type CanonicalMinistryId = (typeof MINISTRY_ALIAS_MAP)[MinistryId];
type SpecialistDomain = keyof typeof SPECIALIST_ALIAS_MAP;
type CanonicalSpecialistDomain = (typeof SPECIALIST_ALIAS_MAP)[SpecialistDomain];

export function normalizeMinistryId(ministry?: string): CanonicalMinistryId | undefined {
  if (!ministry) {
    return undefined;
  }
  return MINISTRY_ALIAS_MAP[ministry as MinistryId];
}

export function getMinistryDisplayName(ministry?: string): string | undefined {
  const canonical = normalizeMinistryId(ministry);
  return canonical ? MINISTRY_LABELS[canonical] : ministry;
}

export function normalizeSpecialistDomain(params: {
  domain?: string;
  goal?: string;
  context?: string;
}): CanonicalSpecialistDomain | undefined {
  if (!params.domain) {
    return undefined;
  }
  if (params.domain !== 'live-ops') {
    return SPECIALIST_ALIAS_MAP[params.domain as SpecialistDomain];
  }
  const text = `${params.goal ?? ''}\n${params.context ?? ''}`.toLowerCase();
  const productSignals = ['产品', '规划', '路线', '版本', '优先级', '功能', '体验'];
  const hasStrongProductSignal = productSignals.some(signal => text.includes(signal));
  return hasStrongProductSignal ? 'product-strategy' : 'growth-marketing';
}

export function getSpecialistDisplayName(params: {
  domain?: string;
  goal?: string;
  context?: string;
}): string | undefined {
  const canonical = normalizeSpecialistDomain(params);
  return canonical ? SPECIALIST_LABELS[canonical] : params.domain;
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
