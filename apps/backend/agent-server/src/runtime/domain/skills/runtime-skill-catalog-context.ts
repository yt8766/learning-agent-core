import type { SkillCard } from '@agent/core';
import type { RuntimeHost } from '../../core/runtime.host';

export interface RuntimeSkillCatalogContextInput {
  skillRegistry: () => RuntimeHost['skillRegistry'];
  llmProvider: () => RuntimeHost['llmProvider'];
  registerSkillWorker: (skill: SkillCard) => void;
}

export function createSkillCatalogContext(input: RuntimeSkillCatalogContextInput) {
  return {
    skillRegistry: input.skillRegistry(),
    llmProvider: input.llmProvider(),
    registerSkillWorker: input.registerSkillWorker
  };
}
