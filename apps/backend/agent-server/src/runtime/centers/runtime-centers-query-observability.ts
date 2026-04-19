function collectTaskModels(task: {
  llmUsage?: {
    models?: Array<{
      model?: string;
    }>;
  };
  modelRoute?: Array<{
    selectedModel?: string;
    defaultModel?: string;
  }>;
  trace?: Array<{
    modelUsed?: string;
  }>;
}) {
  const models = new Set<string>();

  for (const item of task.llmUsage?.models ?? []) {
    if (item.model) {
      models.add(item.model);
    }
  }

  for (const item of task.modelRoute ?? []) {
    if (item.selectedModel) {
      models.add(item.selectedModel);
    }
    if (item.defaultModel) {
      models.add(item.defaultModel);
    }
  }

  for (const item of task.trace ?? []) {
    if (item.modelUsed) {
      models.add(item.modelUsed);
    }
  }

  return models;
}

function collectTaskPricingSources(task: {
  llmUsage?: {
    models?: Array<{
      pricingSource?: string;
    }>;
  };
}) {
  const pricingSources = new Set<string>();

  for (const item of task.llmUsage?.models ?? []) {
    if (item.pricingSource) {
      pricingSources.add(item.pricingSource);
    }
  }

  return pricingSources;
}

export function matchesRunObservatoryTaskFilters(
  task: {
    llmUsage?: {
      models?: Array<{
        model?: string;
        pricingSource?: string;
      }>;
    };
    modelRoute?: Array<{
      selectedModel?: string;
      defaultModel?: string;
    }>;
    trace?: Array<{
      modelUsed?: string;
    }>;
  },
  filters?: {
    model?: string;
    pricingSource?: string;
  }
) {
  if (filters?.model) {
    const models = collectTaskModels(task);
    if (!models.has(filters.model)) {
      return false;
    }
  }

  if (filters?.pricingSource) {
    const pricingSources = collectTaskPricingSources(task);
    if (!pricingSources.has(filters.pricingSource)) {
      return false;
    }
  }

  return true;
}
