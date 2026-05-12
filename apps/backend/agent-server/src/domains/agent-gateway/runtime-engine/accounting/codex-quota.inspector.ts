import {
  DeterministicProviderQuotaInspector,
  type DeterministicProviderQuotaInspectorOptions
} from './provider-quota-inspector';

export class CodexQuotaInspector extends DeterministicProviderQuotaInspector {
  constructor(options: DeterministicProviderQuotaInspectorOptions = {}) {
    super('codex', { defaultModel: 'gpt-5-codex', ...options });
  }
}
