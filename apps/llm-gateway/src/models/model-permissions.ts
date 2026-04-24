export function isModelAllowedForKey(allowedModels: readonly string[], requestedModel: string): boolean {
  return allowedModels.includes('*') || allowedModels.includes(requestedModel);
}
