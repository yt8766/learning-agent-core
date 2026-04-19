import { createDefaultRuntimeLlmProvider } from '@agent/adapters';
import type { AgentRuntimeOptions } from '@agent/runtime';

type DefaultPlatformRuntimeOptionsInput = Omit<AgentRuntimeOptions, 'profile'> & {
  workspaceRoot?: string;
};

export function createDefaultPlatformRuntimeOptions(
  input: DefaultPlatformRuntimeOptionsInput = {}
): AgentRuntimeOptions {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();

  return {
    ...input,
    profile: 'platform',
    settingsOptions: {
      workspaceRoot,
      ...(input.settingsOptions ?? {})
    },
    createLlmProvider:
      input.llmProvider || input.createLlmProvider
        ? input.createLlmProvider
        : ({ settings, semanticCacheRepository }) =>
            createDefaultRuntimeLlmProvider({
              settings,
              semanticCacheRepository
            })
  };
}

export type { DefaultPlatformRuntimeOptionsInput };
