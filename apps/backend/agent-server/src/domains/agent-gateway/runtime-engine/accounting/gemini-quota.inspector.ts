import {
  DeterministicProviderQuotaInspector,
  type DeterministicProviderQuotaInspectorOptions
} from './provider-quota-inspector';

export class GeminiQuotaInspector extends DeterministicProviderQuotaInspector {
  constructor(options: DeterministicProviderQuotaInspectorOptions = {}) {
    super('gemini', { defaultModel: 'gemini-2.5-pro', ...options });
  }
}
