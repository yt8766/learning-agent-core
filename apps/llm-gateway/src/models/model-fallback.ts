export interface FallbackModel {
  alias: string;
  enabled: boolean;
  fallbackAliases?: string[];
}

export type ResolveGatewayModel<T extends FallbackModel> = (alias: string) => T | undefined;

export function buildFallbackChain<T extends FallbackModel>(
  requestedAlias: string,
  resolveModel: ResolveGatewayModel<T>,
  maxDepth: number
): T[] {
  const requestedModel = resolveEnabledModel(requestedAlias, resolveModel);
  if (!requestedModel) {
    return [];
  }

  const visited = new Set<string>([requestedModel.alias]);
  const candidates: T[] = [requestedModel];
  const depthLimit = Math.max(0, maxDepth);

  function visitFallbacks(model: T, depth: number): void {
    if (depth >= depthLimit) {
      return;
    }

    for (const fallbackAlias of model.fallbackAliases ?? []) {
      if (visited.has(fallbackAlias)) {
        continue;
      }

      const fallbackModel = resolveEnabledModel(fallbackAlias, resolveModel);
      if (!fallbackModel) {
        continue;
      }

      visited.add(fallbackModel.alias);
      candidates.push(fallbackModel);
      visitFallbacks(fallbackModel, depth + 1);
    }
  }

  visitFallbacks(requestedModel, 0);

  return candidates;
}

function resolveEnabledModel<T extends FallbackModel>(
  alias: string,
  resolveModel: ResolveGatewayModel<T>
): T | undefined {
  const model = resolveModel(alias);
  return model?.enabled ? model : undefined;
}
