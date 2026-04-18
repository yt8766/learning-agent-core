import { DEFAULT_DATA_PATHS, buildProfileOverrides, mergeNormalizedPolicy } from '../shared/settings-defaults';
import { resolveFromWorkspaceRoot } from '../utils/settings-helpers';
import type { PolicyConfig, RuntimeSettings, RuntimeSettingsOverrides } from '../schemas/settings.types';

export function buildMergedOverrides(
  profile: RuntimeSettings['profile'],
  overrides: RuntimeSettingsOverrides | undefined
): RuntimeSettingsOverrides {
  const profileOverrides = buildProfileOverrides(profile);
  const normalizedPolicy: Partial<PolicyConfig> = mergeNormalizedPolicy(profileOverrides.policy, overrides?.policy);

  return {
    ...profileOverrides,
    ...overrides,
    policy: normalizedPolicy
  };
}

export function resolveSettingsPaths(
  overrides: RuntimeSettingsOverrides,
  runtimeEnv: NodeJS.ProcessEnv,
  workspaceRoot: string
) {
  return {
    memoryFilePath: resolveFromWorkspaceRoot(
      overrides.memoryFilePath ?? runtimeEnv.MEMORY_FILE_PATH ?? DEFAULT_DATA_PATHS.memoryFilePath,
      workspaceRoot
    ),
    rulesFilePath: resolveFromWorkspaceRoot(
      overrides.rulesFilePath ?? runtimeEnv.RULES_FILE_PATH ?? DEFAULT_DATA_PATHS.rulesFilePath,
      workspaceRoot
    ),
    vectorIndexFilePath: resolveFromWorkspaceRoot(
      overrides.vectorIndexFilePath ?? runtimeEnv.VECTOR_INDEX_FILE_PATH ?? DEFAULT_DATA_PATHS.vectorIndexFilePath,
      workspaceRoot
    ),
    tasksStateFilePath: resolveFromWorkspaceRoot(
      overrides.tasksStateFilePath ?? runtimeEnv.TASKS_STATE_FILE_PATH ?? DEFAULT_DATA_PATHS.tasksStateFilePath,
      workspaceRoot
    ),
    semanticCacheFilePath: resolveFromWorkspaceRoot(
      overrides.semanticCacheFilePath ??
        runtimeEnv.SEMANTIC_CACHE_FILE_PATH ??
        DEFAULT_DATA_PATHS.semanticCacheFilePath,
      workspaceRoot
    ),
    skillsRoot: resolveFromWorkspaceRoot(
      overrides.skillsRoot ?? runtimeEnv.SKILL_RUNTIME_ROOT ?? runtimeEnv.SKILLS_ROOT ?? DEFAULT_DATA_PATHS.skillsRoot,
      workspaceRoot
    ),
    pluginsLabRoot: resolveFromWorkspaceRoot(
      overrides.pluginsLabRoot ??
        runtimeEnv.SKILL_RUNTIME_PLUGINS_LAB_ROOT ??
        runtimeEnv.PLUGINS_LAB_ROOT ??
        DEFAULT_DATA_PATHS.pluginsLabRoot,
      workspaceRoot
    ),
    skillSourcesRoot: resolveFromWorkspaceRoot(
      overrides.skillSourcesRoot ??
        runtimeEnv.SKILL_RUNTIME_SOURCES_ROOT ??
        runtimeEnv.SKILL_SOURCES_ROOT ??
        DEFAULT_DATA_PATHS.skillSourcesRoot,
      workspaceRoot
    ),
    skillPackagesRoot: resolveFromWorkspaceRoot(
      overrides.skillPackagesRoot ??
        runtimeEnv.SKILL_RUNTIME_PACKAGES_ROOT ??
        runtimeEnv.SKILL_PACKAGES_ROOT ??
        DEFAULT_DATA_PATHS.skillPackagesRoot,
      workspaceRoot
    ),
    skillReceiptsRoot: resolveFromWorkspaceRoot(
      overrides.skillReceiptsRoot ??
        runtimeEnv.SKILL_RUNTIME_RECEIPTS_ROOT ??
        runtimeEnv.SKILL_RECEIPTS_ROOT ??
        DEFAULT_DATA_PATHS.skillReceiptsRoot,
      workspaceRoot
    ),
    skillInternalRoot: resolveFromWorkspaceRoot(
      overrides.skillInternalRoot ??
        runtimeEnv.SKILL_RUNTIME_INTERNAL_ROOT ??
        runtimeEnv.SKILL_INTERNAL_ROOT ??
        DEFAULT_DATA_PATHS.skillInternalRoot,
      workspaceRoot
    ),
    registryFilePath: resolveFromWorkspaceRoot(
      overrides.registryFilePath ??
        runtimeEnv.SKILL_RUNTIME_REGISTRY_FILE_PATH ??
        runtimeEnv.SKILL_REGISTRY_FILE_PATH ??
        DEFAULT_DATA_PATHS.registryFilePath,
      workspaceRoot
    ),
    knowledgeRoot: resolveFromWorkspaceRoot(
      overrides.knowledgeRoot ?? runtimeEnv.KNOWLEDGE_ROOT ?? DEFAULT_DATA_PATHS.knowledgeRoot,
      workspaceRoot
    )
  };
}
