import { join } from 'node:path';

import { describeSkillSourceProfilePolicy } from '@agent/runtime';
import { loadAgentSkillManifests } from '@agent/skill';
import type {
  LocalSkillSuggestionRecord,
  RequestedExecutionHints,
  SpecialistDomain,
  SkillManifestRecord,
  SkillSearchStatus,
  SkillSourceRecord
} from '@agent/core';
import type { SkillSourceSyncResult } from './skill-source-sync.service';
import {
  buildSkillSearchMcpRecommendation,
  buildSkillSearchSafetyNotes,
  resolveSkillSearchStatus
} from '../domain/skills/runtime-skill-search-resolution';

import { WORKSPACE_SKILL_DRAFT_SOURCE_ID } from '../domain/skills/runtime-workspace-skill-draft-manifests';
import {
  buildConnectorTemplateSuggestions,
  evaluateSkillManifestSafety,
  findAutoInstallableManifest
} from './runtime-skill-safety';

export interface RuntimeSkillSourcesContext {
  settings: {
    workspaceRoot: string;
    skillsRoot: string;
    skillSourcesRoot: string;
    profile: any;
    policy: {
      sourcePolicyMode: string;
      skillInstallMode: string;
    };
  };
  toolRegistry: {
    get: (toolName: string) => { riskLevel: 'low' | 'medium' | 'high' | 'critical' } | undefined;
  };
  skillRegistry: {
    list: () => Promise<Array<{ id: string }>>;
  };
  skillSourceSyncService: {
    readCachedSyncState: (source: SkillSourceRecord) => Promise<
      | {
          lastSyncedAt?: string;
          healthState?: SkillSourceRecord['healthState'];
          healthReason?: string;
        }
      | undefined
    >;
    readCachedManifests: (source: SkillSourceRecord) => Promise<SkillManifestRecord[]>;
    syncSource: (source: SkillSourceRecord) => Promise<SkillSourceSyncResult>;
  };
  remoteSkillDiscoveryService: {
    discover: (options: any) =>
      | Promise<{
          capabilityGapDetected: boolean;
          suggestions: LocalSkillSuggestionRecord[];
          triggerReason?: string;
          remoteSearch?: {
            query: string;
            discoverySource: string;
            executedAt: string;
            results: LocalSkillSuggestionRecord[];
          };
        }>
      | {
          capabilityGapDetected: boolean;
          suggestions: LocalSkillSuggestionRecord[];
          triggerReason?: string;
          remoteSearch?: {
            query: string;
            discoverySource: string;
            executedAt: string;
            results: LocalSkillSuggestionRecord[];
          };
        };
  };
  getDisabledSkillSourceIds: () => Promise<string[]>;
  autoInstallLocalManifest: (manifest: SkillManifestRecord) => Promise<unknown>;
  listWorkspaceSkillDraftManifests?: () => Promise<SkillManifestRecord[]>;
}

export async function listSkillSources(context: RuntimeSkillSourcesContext): Promise<SkillSourceRecord[]> {
  const disabledSourceIds = new Set(await context.getDisabledSkillSourceIds());
  const baseSources: Array<Omit<SkillSourceRecord, 'enabled' | 'healthState' | 'healthReason' | 'profilePolicy'>> = [
    {
      id: 'workspace-skills',
      name: 'Workspace Skills',
      kind: 'internal',
      baseUrl: `${context.settings.workspaceRoot}/skills`,
      discoveryMode: 'local-dir',
      syncStrategy: 'manual',
      allowedProfiles: ['platform', 'company', 'personal', 'cli'],
      trustClass: 'internal',
      priority: 'workspace/internal',
      authMode: 'none'
    },
    {
      id: WORKSPACE_SKILL_DRAFT_SOURCE_ID,
      name: 'Workspace Skill Drafts',
      kind: 'internal',
      baseUrl: `${context.settings.workspaceRoot}/data/skills/drafts`,
      discoveryMode: 'local-dir',
      syncStrategy: 'manual',
      allowedProfiles: ['platform', 'company', 'personal', 'cli'],
      trustClass: 'internal',
      priority: 'workspace/internal',
      authMode: 'none'
    },
    {
      id: 'managed-local-skills',
      name: 'Managed Local Skill Lab',
      kind: 'internal',
      baseUrl: context.settings.skillsRoot,
      discoveryMode: 'local-dir',
      syncStrategy: 'manual',
      allowedProfiles: ['platform', 'company', 'personal', 'cli'],
      trustClass: 'internal',
      priority: 'managed/local',
      authMode: 'none'
    },
    {
      id: 'skills-sh-directory',
      name: 'skills.sh Directory',
      kind: 'git',
      baseUrl: 'https://skills.sh',
      discoveryMode: 'git-registry',
      indexUrl: 'https://skills.sh',
      packageBaseUrl: 'https://github.com',
      syncStrategy: 'on-demand',
      allowedProfiles: ['platform', 'personal', 'cli'],
      trustClass: 'curated',
      priority: 'bundled/marketplace',
      authMode: 'none'
    },
    {
      id: 'bundled-marketplace',
      name: 'Bundled Marketplace',
      kind: 'marketplace',
      baseUrl: context.settings.skillSourcesRoot,
      discoveryMode: 'remote-index',
      indexUrl: join(context.settings.skillSourcesRoot, 'index.json'),
      packageBaseUrl: context.settings.skillSourcesRoot,
      syncStrategy: 'on-demand',
      allowedProfiles: ['platform', 'personal', 'cli'],
      trustClass: 'curated',
      priority: 'bundled/marketplace',
      authMode: 'none'
    }
  ];

  return Promise.all(
    baseSources.map(async source => {
      const remoteState =
        source.discoveryMode && source.discoveryMode !== 'local-dir'
          ? await context.skillSourceSyncService.readCachedSyncState({
              ...source,
              enabled: true
            } as SkillSourceRecord)
          : undefined;
      const profilePolicy = describeSkillSourceProfilePolicy(
        source.id,
        context.settings.profile as never,
        context.settings.policy.sourcePolicyMode as never
      );
      const explicitlyDisabled = disabledSourceIds.has(source.id);
      return {
        ...source,
        enabled: !explicitlyDisabled && profilePolicy.enabledByProfile,
        lastSyncedAt: remoteState?.lastSyncedAt,
        healthState:
          explicitlyDisabled || !profilePolicy.enabledByProfile ? 'disabled' : (remoteState?.healthState ?? 'healthy'),
        healthReason: explicitlyDisabled
          ? '该来源已在控制台停用。'
          : !profilePolicy.enabledByProfile
            ? profilePolicy.reason
            : remoteState?.healthReason,
        profilePolicy
      };
    })
  );
}

export async function listSkillManifests(context: RuntimeSkillSourcesContext): Promise<SkillManifestRecord[]> {
  const sources = await listSkillSources(context);
  const workspaceDraftSource = sources.find(source => source.id === WORKSPACE_SKILL_DRAFT_SOURCE_ID);
  const localSources = sources.filter(
    source =>
      source.id !== WORKSPACE_SKILL_DRAFT_SOURCE_ID &&
      (source.discoveryMode ?? 'local-dir') === 'local-dir' &&
      (source.enabled || source.id === 'workspace-skills')
  );
  const [localManifests, workspaceDraftManifests, remoteManifestsBySource] = await Promise.all([
    loadAgentSkillManifests(localSources),
    workspaceDraftSource?.enabled ? (context.listWorkspaceSkillDraftManifests?.() ?? Promise.resolve([])) : [],
    Promise.all(
      sources
        .filter(source => source.enabled && (source.discoveryMode ?? 'local-dir') !== 'local-dir')
        .map(async source => context.skillSourceSyncService.readCachedManifests(source))
    )
  ]);
  const merged = [...localManifests, ...workspaceDraftManifests, ...remoteManifestsBySource.flat()];
  const manifests = Array.from(
    new Map(merged.map(item => [`${item.sourceId}:${item.id}:${item.version}`, item])).values()
  );
  return manifests.map(manifest => ({
    ...manifest,
    safety: evaluateSkillManifestSafety(
      context,
      manifest,
      sources.find(source => source.id === manifest.sourceId)
    )
  }));
}

export async function searchLocalSkillSuggestions(
  context: RuntimeSkillSourcesContext,
  goal: string,
  options?: {
    usedInstalledSkills?: string[];
    limit?: number;
    requestedHints?: RequestedExecutionHints;
    specialistDomain?: SpecialistDomain | string;
  }
) {
  const [installedSkills, sources, manifests] = await Promise.all([
    context.skillRegistry.list(),
    listSkillSources(context),
    listSkillManifests(context)
  ]);

  return context.remoteSkillDiscoveryService.discover({
    goal,
    installedSkills,
    manifests,
    sources,
    profile: context.settings.profile,
    usedInstalledSkills: options?.usedInstalledSkills,
    requestedHints: options?.requestedHints,
    specialistDomain: options?.specialistDomain,
    limit: options?.limit ?? 5
  });
}

export async function resolveTaskSkillSearch(
  context: RuntimeSkillSourcesContext,
  goal: string,
  options?: {
    usedInstalledSkills?: string[];
    requestedHints?: RequestedExecutionHints;
    specialistDomain?: SpecialistDomain | string;
  }
) {
  let searchResult = await searchLocalSkillSuggestions(context, goal, {
    usedInstalledSkills: options?.usedInstalledSkills,
    requestedHints: options?.requestedHints,
    specialistDomain: options?.specialistDomain,
    limit: 5
  });
  const hasReadySuggestion = searchResult.suggestions.some(
    item => item.kind === 'installed' && item.availability === 'ready'
  );
  const manifests = await listSkillManifests(context);

  const enrichedSuggestions = searchResult.suggestions.map(suggestion => ({
    ...suggestion,
    safety: evaluateSkillManifestSafety(
      context,
      manifests.find(item => item.id === suggestion.id)
    )
  }));
  searchResult = {
    ...searchResult,
    suggestions: [...enrichedSuggestions, ...buildConnectorTemplateSuggestions(goal)].slice(0, 6)
  };
  let status: SkillSearchStatus = resolveSkillSearchStatus(searchResult);
  let autoInstalledManifestId: string | undefined;

  if (
    context.settings.policy.skillInstallMode === 'low-risk-auto' &&
    searchResult.capabilityGapDetected &&
    !hasReadySuggestion
  ) {
    const manifest = await findAutoInstallableManifest(context, searchResult.suggestions);
    if (manifest) {
      await context.autoInstallLocalManifest(manifest);
      searchResult = await searchLocalSkillSuggestions(context, goal, {
        usedInstalledSkills: options?.usedInstalledSkills,
        requestedHints: options?.requestedHints,
        specialistDomain: options?.specialistDomain,
        limit: 5
      });
      status = 'auto-installed';
      autoInstalledManifestId = manifest.id;
    }
  }

  const safetyNotes = buildSkillSearchSafetyNotes({
    suggestions: searchResult.suggestions,
    remoteSearch: searchResult.remoteSearch,
    profile: String(context.settings.profile),
    autoInstalledManifestId
  });

  return {
    capabilityGapDetected: searchResult.capabilityGapDetected,
    status,
    suggestions: searchResult.suggestions,
    safetyNotes,
    query: goal,
    triggerReason: searchResult.triggerReason,
    remoteSearch: searchResult.remoteSearch
      ? {
          query: searchResult.remoteSearch.query,
          discoverySource: searchResult.remoteSearch.discoverySource,
          resultCount: searchResult.remoteSearch.results.length,
          executedAt: searchResult.remoteSearch.executedAt
        }
      : undefined,
    mcpRecommendation: buildSkillSearchMcpRecommendation(
      goal,
      searchResult.suggestions,
      searchResult.capabilityGapDetected
    )
  } as const;
}

export async function syncEnabledRemoteSkillSources(context: RuntimeSkillSourcesContext): Promise<void> {
  const sources = await listSkillSources(context);
  const remoteSources = sources.filter(
    source => source.enabled && (source.discoveryMode ?? 'local-dir') !== 'local-dir'
  );
  for (const source of remoteSources) {
    await context.skillSourceSyncService.syncSource(source).catch(() => undefined);
  }
}
