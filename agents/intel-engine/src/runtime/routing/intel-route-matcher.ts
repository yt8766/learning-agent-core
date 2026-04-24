type IntelRoutePriority = 'P0' | 'P1' | 'P2';
type IntelRouteStatus = 'pending' | 'confirmed' | 'closed';
type IntelRouteDeliveryKind = 'alert' | 'digest';

export interface IntelRouteSignal {
  id: string;
  category: string;
  priority: IntelRoutePriority;
  status: IntelRouteStatus;
  title: string;
  deliveryKind?: IntelRouteDeliveryKind;
}

export interface IntelRouteRuleWhen {
  categoryIn?: string[];
  priorityIn?: IntelRoutePriority[];
  statusIn?: IntelRouteStatus[];
  deliveryKindIn?: IntelRouteDeliveryKind[];
}

export interface IntelRouteRule {
  id: string;
  enabled: boolean;
  when: IntelRouteRuleWhen;
  sendTo: string[];
  template: string;
}

export interface IntelRouteConfig {
  defaults: {
    suppressDuplicateHours: number;
  };
  rules: IntelRouteRule[];
}

export interface IntelRouteMatch {
  ruleId: string;
  template: string;
  sendTo: string[];
}

export interface IntelRouteMatchResult {
  signalId: string;
  ruleIds: string[];
  matches: IntelRouteMatch[];
  deliveryTargets: string[];
  suppressionWindowHours: number;
}

export interface MatchIntelRoutesInput {
  signal: IntelRouteSignal;
  routes: IntelRouteConfig;
}

function matchesConfiguredValues<T extends string>(candidate: T, configuredValues?: T[]): boolean {
  return configuredValues === undefined || configuredValues.length === 0 || configuredValues.includes(candidate);
}

function appendUnique(values: string[], nextValues: string[]): string[] {
  const merged = [...values];

  for (const value of nextValues) {
    if (!merged.includes(value)) {
      merged.push(value);
    }
  }

  return merged;
}

export function matchIntelRoutes(input: MatchIntelRoutesInput): IntelRouteMatchResult {
  const matches: IntelRouteMatch[] = [];
  let deliveryTargets: string[] = [];

  for (const rule of input.routes.rules) {
    if (!rule.enabled) {
      continue;
    }

    const when = rule.when ?? {};
    const categoryMatches = matchesConfiguredValues(input.signal.category, when.categoryIn);
    const priorityMatches = matchesConfiguredValues(input.signal.priority, when.priorityIn);
    const statusMatches = matchesConfiguredValues(input.signal.status, when.statusIn);
    const deliveryKindMatches = matchesConfiguredValues(input.signal.deliveryKind ?? 'alert', when.deliveryKindIn);

    if (!categoryMatches || !priorityMatches || !statusMatches || !deliveryKindMatches) {
      continue;
    }

    matches.push({
      ruleId: rule.id,
      template: rule.template,
      sendTo: [...new Set(rule.sendTo)]
    });
    deliveryTargets = appendUnique(deliveryTargets, rule.sendTo);
  }

  return {
    signalId: input.signal.id,
    ruleIds: matches.map(match => match.ruleId),
    matches,
    deliveryTargets,
    suppressionWindowHours: input.routes.defaults.suppressDuplicateHours
  };
}
