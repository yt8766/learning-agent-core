import type { ProviderSettingsRecord } from '@agent/config';

import type { LlmProvider } from '../base/llm-provider.types';

export interface LlmProviderFactory {
  type: string;
  create(config: ProviderSettingsRecord): LlmProvider;
}
