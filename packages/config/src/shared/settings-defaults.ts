export const DEFAULT_DATA_PATHS = {
  memoryFilePath: 'profile-storage/platform/memory/records.jsonl',
  rulesFilePath: 'profile-storage/platform/rules/rules.jsonl',
  vectorIndexFilePath: 'profile-storage/platform/memory/vector-index.json',
  tasksStateFilePath: 'profile-storage/platform/runtime/tasks-state.json',
  semanticCacheFilePath: 'profile-storage/platform/runtime/semantic-cache.json',
  skillsRoot: 'profile-storage/platform/skills',
  pluginsLabRoot: 'profile-storage/platform/skills/plugins-lab',
  skillSourcesRoot: 'profile-storage/platform/skills/remote-sources',
  skillPackagesRoot: 'profile-storage/platform/skills/installed',
  skillReceiptsRoot: 'profile-storage/platform/skills/receipts',
  skillInternalRoot: 'profile-storage/platform/skills/installed/internal',
  registryFilePath: 'profile-storage/platform/skills/registry.json',
  knowledgeRoot: 'profile-storage/platform/knowledge'
} as const;

export { buildProfileOverrides } from '../profiles/runtime-profile-overrides';
export { mergeNormalizedPolicy } from '../policies/runtime-policy-defaults';
