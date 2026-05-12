import {
  DeterministicProviderQuotaInspector,
  type DeterministicProviderQuotaInspectorOptions
} from './provider-quota-inspector';

export class AntigravityQuotaInspector extends DeterministicProviderQuotaInspector {
  constructor(options: DeterministicProviderQuotaInspectorOptions = {}) {
    super('antigravity', { defaultModel: 'antigravity-model', ...options });
  }
}
