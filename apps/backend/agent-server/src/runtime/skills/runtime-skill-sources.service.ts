import { join } from 'node:path';

import { describeSkillSourceProfilePolicy } from '@agent/runtime';
import { loadAgentSkillManifests } from '@agent/skill-runtime';
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
  const localSources = sources.filter(
    source =>
      (source.discoveryMode ?? 'local-dir') === 'local-dir' && (source.enabled || source.id === 'workspace-skills')
  );
  const [localManifests, remoteManifestsBySource] = await Promise.all([
    loadAgentSkillManifests(localSources),
    Promise.all(
      sources
        .filter(source => source.enabled && (source.discoveryMode ?? 'local-dir') !== 'local-dir')
        .map(async source => context.skillSourceSyncService.readCachedManifests(source))
    )
  ]);
  const merged = [...localManifests, ...remoteManifestsBySource.flat()];
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

  const safetyNotes = searchResult.suggestions.slice(0, 3).map(suggestion => {
    const safety = suggestion.safety;
    return safety
      ? `${suggestion.displayName}：${suggestion.availability}，${safety.verdict}，trust=${safety.trustScore}，${safety.reasons.join('；')}`
      : `${suggestion.displayName}：${suggestion.availability}`;
  });

  if (searchResult.remoteSearch) {
    safetyNotes.unshift(
      `已通过 ${searchResult.remoteSearch.discoverySource} 远程检索 ${searchResult.remoteSearch.results.length} 个候选。`
    );
  }

  let status: SkillSearchStatus = searchResult.capabilityGapDetected
    ? searchResult.suggestions.some(item =>
        ['installable', 'installable-local', 'installable-remote', 'approval-required'].includes(item.availability)
      )
      ? 'suggested'
      : 'blocked'
    : 'not-needed';

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
      safetyNotes.unshift(`已按当前 profile=${context.settings.profile} 自动安装低风险技能 ${manifest.id}。`);
    }
  }

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
    mcpRecommendation: buildMcpRecommendation(goal, searchResult.suggestions, searchResult.capabilityGapDetected)
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

function buildMcpRecommendation(
  goal: string,
  suggestions: LocalSkillSuggestionRecord[],
  capabilityGapDetected: boolean
) {
  const connectorSuggestion = suggestions.find(item => item.kind === 'connector-template');
  if (connectorSuggestion?.id === 'github-mcp-template') {
    return {
      kind: 'connector' as const,
      summary: '当前更缺 GitHub MCP connector，不只是 skill。',
      reason: connectorSuggestion.reason,
      connectorTemplateId: 'github-mcp-template' as const
    };
  }
  if (connectorSuggestion?.id === 'browser-mcp-template') {
    return {
      kind: 'connector' as const,
      summary: '当前更缺 Browser MCP connector，不只是 skill。',
      reason: connectorSuggestion.reason,
      connectorTemplateId: 'browser-mcp-template' as const
    };
  }
  if (connectorSuggestion?.id === 'lark-mcp-template') {
    return {
      kind: 'connector' as const,
      summary: '当前更缺 Lark MCP connector，不只是 skill。',
      reason: connectorSuggestion.reason,
      connectorTemplateId: 'lark-mcp-template' as const
    };
  }
  if (capabilityGapDetected) {
    return {
      kind: 'skill' as const,
      summary: '当前能力链路存在缺口，优先建议补 skill。',
      reason: `目标“${goal}”当前没有足够的 ready skill。`
    };
  }
  return {
    kind: 'not-needed' as const,
    summary: '当前没有明显的 MCP 或 skill 缺口。',
    reason: '本轮已有本地能力可继续推进。'
  };
}
