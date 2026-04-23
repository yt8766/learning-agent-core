import type { ProviderSettingsRecord } from '@agent/config';

import type { LlmProvider } from '../../contracts/llm/llm-provider.types';

export interface LlmProviderFactory {
  type: string;
  create(config: ProviderSettingsRecord): LlmProvider;
}
