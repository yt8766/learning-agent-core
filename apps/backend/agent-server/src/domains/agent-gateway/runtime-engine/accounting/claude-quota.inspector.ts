import {
  DeterministicProviderQuotaInspector,
  type DeterministicProviderQuotaInspectorOptions
} from './provider-quota-inspector';

export class ClaudeQuotaInspector extends DeterministicProviderQuotaInspector {
  constructor(options: DeterministicProviderQuotaInspectorOptions = {}) {
    super('claude', { defaultModel: 'claude-opus-4', ...options });
  }
}
