export const DEFAULT_DATA_PATHS = {
  memoryFilePath: 'data/memory/records.jsonl',
  rulesFilePath: 'data/rules/rules.jsonl',
  vectorIndexFilePath: 'data/memory/vector-index.json',
  tasksStateFilePath: 'data/runtime/tasks-state.json',
  semanticCacheFilePath: 'data/runtime/semantic-cache.json',
  skillsRoot: 'data/skill-runtime',
  pluginsLabRoot: 'data/skill-runtime/plugins-lab',
  skillSourcesRoot: 'data/skill-runtime/remote-sources',
  skillPackagesRoot: 'data/skill-runtime/installed',
  skillReceiptsRoot: 'data/skill-runtime/receipts',
  skillInternalRoot: 'data/skill-runtime/installed/internal',
  registryFilePath: 'data/skill-runtime/registry.json',
  knowledgeRoot: 'data/knowledge'
} as const;

export { buildProfileOverrides } from '../profiles/runtime-profile-overrides';
export { mergeNormalizedPolicy } from '../policies/runtime-policy-defaults';
