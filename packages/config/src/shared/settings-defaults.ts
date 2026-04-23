export const DEFAULT_DATA_PATHS = {
  memoryFilePath: 'data/memory/records.jsonl',
  rulesFilePath: 'data/rules/rules.jsonl',
  vectorIndexFilePath: 'data/memory/vector-index.json',
  tasksStateFilePath: 'data/runtime/tasks-state.json',
  semanticCacheFilePath: 'data/runtime/semantic-cache.json',
  skillsRoot: 'data/skills',
  pluginsLabRoot: 'data/skills/plugins-lab',
  skillSourcesRoot: 'data/skills/remote-sources',
  skillPackagesRoot: 'data/skills/installed',
  skillReceiptsRoot: 'data/skills/receipts',
  skillInternalRoot: 'data/skills/installed/internal',
  registryFilePath: 'data/skills/registry.json',
  knowledgeRoot: 'data/knowledge'
} as const;

export { buildProfileOverrides } from '../profiles/runtime-profile-overrides';
export { mergeNormalizedPolicy } from '../policies/runtime-policy-defaults';
