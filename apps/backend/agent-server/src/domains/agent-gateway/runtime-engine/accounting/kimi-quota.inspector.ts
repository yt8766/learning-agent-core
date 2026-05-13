import {
  DeterministicProviderQuotaInspector,
  type DeterministicProviderQuotaInspectorOptions
} from './provider-quota-inspector';

export class KimiQuotaInspector extends DeterministicProviderQuotaInspector {
  constructor(options: DeterministicProviderQuotaInspectorOptions = {}) {
    super('kimi', { defaultModel: 'kimi-k2', ...options });
  }
}
