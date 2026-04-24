import {
  matchIntelRoutes,
  type IntelRouteConfig,
  type IntelRouteSignal,
  type IntelRouteMatchResult
} from '../../../runtime/routing/intel-route-matcher';

export interface MatchRoutesNodeInput {
  signal: IntelRouteSignal;
  routes: IntelRouteConfig;
}

export function matchRoutesNode(input: MatchRoutesNodeInput): IntelRouteMatchResult {
  return matchIntelRoutes(input);
}
