export interface GatewayModelConfig {
  alias: string;
  provider: string;
  providerModel: string;
  enabled: boolean;
  contextWindow: number;
  fallbackAliases: string[];
  adminOnly: boolean;
}

export interface ModelRegistry {
  resolve(alias: string): GatewayModelConfig | undefined;
  listEnabled(): GatewayModelConfig[];
}

export function createModelRegistry(models: GatewayModelConfig[]): ModelRegistry {
  const enabledModels = models.filter(model => model.enabled).map(cloneModelConfig);
  const modelsByAlias = new Map(enabledModels.map(model => [model.alias, model]));

  return {
    resolve(alias) {
      const model = modelsByAlias.get(alias);
      return model ? cloneModelConfig(model) : undefined;
    },
    listEnabled() {
      return enabledModels.map(cloneModelConfig);
    }
  };
}

export function cloneModelConfig(model: GatewayModelConfig): GatewayModelConfig {
  return {
    ...model,
    fallbackAliases: [...model.fallbackAliases]
  };
}
