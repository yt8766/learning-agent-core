import type { IntelSignal } from '@agent/core';

import {
  matchIntelRoutes,
  type IntelRouteConfig,
  type IntelRouteMatch
} from '../../../runtime/routing/intel-route-matcher';
import {
  DigestGraphStateSchema,
  type DigestGraphState,
  type DigestRouteMatch
} from '../schemas/digest-graph-state.schema';

export interface MatchDigestRoutesNodeInput {
  signals: IntelSignal[];
  routes: IntelRouteConfig;
}

export interface MatchDigestRoutesNodeResult extends Pick<DigestGraphState, 'matchedRoutes'> {
  digestMatches: Array<{
    signalId: string;
    matches: IntelRouteMatch[];
  }>;
}

function isDigestTarget(channelTarget: string): boolean {
  return channelTarget.startsWith('digest_');
}

function isDigestTemplate(template: string): boolean {
  return template.toLowerCase().includes('digest');
}

function toDigestRouteMatch(signalId: string, matches: IntelRouteMatch[]): DigestRouteMatch {
  return {
    signalId,
    routeIds: matches.map(match => match.ruleId),
    channelTargets: [...new Set(matches.flatMap(match => match.sendTo))]
  };
}

export function matchDigestRoutesNode(input: MatchDigestRoutesNodeInput): MatchDigestRoutesNodeResult {
  const digestMatches = input.signals
    .map(signal => {
      const routeResult = matchIntelRoutes({
        signal: {
          id: signal.id,
          category: signal.category,
          priority: signal.priority,
          status: signal.status,
          title: signal.title,
          deliveryKind: 'digest'
        },
        routes: input.routes
      });
      const matches = routeResult.matches
        .map(match => {
          const digestTargets = match.sendTo.filter(channelTarget => isDigestTarget(channelTarget));
          if (digestTargets.length === 0 && !isDigestTemplate(match.template)) {
            return undefined;
          }

          return {
            ...match,
            sendTo: digestTargets.length > 0 ? digestTargets : match.sendTo
          };
        })
        .filter((match): match is IntelRouteMatch => match !== undefined);

      if (matches.length === 0) {
        return undefined;
      }

      return {
        signalId: signal.id,
        matches
      };
    })
    .filter((match): match is { signalId: string; matches: IntelRouteMatch[] } => match !== undefined);

  const matchedRoutes = digestMatches.map(match => toDigestRouteMatch(match.signalId, match.matches));

  return DigestGraphStateSchema.pick({
    matchedRoutes: true
  }).parse({
    matchedRoutes
  }) as MatchDigestRoutesNodeResult;
}
