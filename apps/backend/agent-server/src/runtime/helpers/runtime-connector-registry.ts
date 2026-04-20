import { join } from 'node:path';

import type { RuntimeProfile } from '@agent/config';
import { resolveActiveRoleModels, type RuntimeSettings } from '@agent/config';
import { describeSkillSourceProfilePolicy } from '@agent/runtime';
import { ConfiguredConnectorRecord } from '@agent/core';
import type { SkillCard, WorkerDefinition } from '@agent/core';
import type { McpServerDefinition } from '@agent/tools';

import {
  inferCapabilityCategory,
  inferCapabilityRequiresApproval,
  inferCapabilityRiskLevel,
  resolveInstalledSkillMinistry,
  resolveInstalledSkillModel,
  toCapabilityDisplayName
} from './runtime-worker-utils';
import { buildInstalledSkillTags } from '../domain/learning/runtime-learning-derived-records';

type InstalledSkillModelConfig = Parameters<typeof resolveInstalledSkillModel>[0];
type McpCapabilityRegistryRecord = {
  id: string;
  toolName: string;
  serverId: string;
  displayName: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresApproval: boolean;
  category: 'knowledge' | 'system' | 'action' | 'memory';
  dataScope?: string;
  writeScope?: string;
};
type RegisteredCapabilityTemplate = Omit<McpCapabilityRegistryRecord, 'serverId'>;

export interface RuntimeConnectorRegistryContext {
  settings: {
    workspaceRoot: string;
    skillsRoot: string;
    skillSourcesRoot: string;
    profile: RuntimeProfile;
    policy: {
      sourcePolicyMode: string;
    };
    zhipuModels?: InstalledSkillModelConfig;
  };
  mcpServerRegistry: {
    register: (server: McpServerDefinition) => void;
    setEnabled: (connectorId: string, enabled: boolean) => void;
  };
  mcpCapabilityRegistry: {
    register: (capability: McpCapabilityRegistryRecord) => void;
    listByServer: (connectorId: string) => Array<{ toolName: string }>;
    setServerApprovalOverride: (connectorId: string, effect: string) => void;
    setCapabilityApprovalOverride: (capabilityId: string, effect: string) => void;
  };
  mcpClientManager: {
    describeServers: () => Array<{
      id: string;
      dataScope?: string;
      writeScope?: string;
      discoveredCapabilities?: string[];
    }>;
  };
  orchestrator: {
    setWorkerEnabled: (workerId: string, enabled: boolean) => void;
    listWorkers: () => Array<{ id: string; kind?: string }>;
    isWorkerEnabled?: (workerId: string) => boolean;
    registerWorker: (worker: WorkerDefinition) => void;
  };
}

export function applyGovernanceOverrides(
  context: RuntimeConnectorRegistryContext,
  snapshot: {
    governance?: {
      configuredConnectors?: ConfiguredConnectorRecord[];
      disabledCompanyWorkerIds?: string[];
      disabledConnectorIds?: string[];
      connectorPolicyOverrides?: Array<{ connectorId: string; effect: string }>;
      capabilityPolicyOverrides?: Array<{ capabilityId: string; effect: string }>;
    };
  }
) {
  for (const configured of snapshot.governance?.configuredConnectors ?? []) {
    registerConfiguredConnector(context, configured);
  }
  for (const workerId of snapshot.governance?.disabledCompanyWorkerIds ?? []) {
    context.orchestrator.setWorkerEnabled(workerId, false);
  }
  for (const connectorId of snapshot.governance?.disabledConnectorIds ?? []) {
    context.mcpServerRegistry.setEnabled(connectorId, false);
  }
  for (const override of snapshot.governance?.connectorPolicyOverrides ?? []) {
    context.mcpCapabilityRegistry.setServerApprovalOverride(override.connectorId, override.effect);
  }
  for (const override of snapshot.governance?.capabilityPolicyOverrides ?? []) {
    context.mcpCapabilityRegistry.setCapabilityApprovalOverride(override.capabilityId, override.effect);
  }
}

export function registerConfiguredConnector(
  context: RuntimeConnectorRegistryContext,
  config: ConfiguredConnectorRecord
) {
  const serverId = config.connectorId;
  const isGithub = config.templateId === 'github-mcp-template';
  const isLark = config.templateId === 'lark-mcp-template';
  context.mcpServerRegistry.register({
    id: serverId,
    displayName: config.displayName ?? (isGithub ? 'GitHub MCP' : isLark ? 'Lark MCP' : 'Browser MCP'),
    transport: config.transport,
    enabled: config.enabled ?? true,
    endpoint: config.transport === 'http' ? config.endpoint : undefined,
    command: config.transport === 'stdio' ? config.command : undefined,
    args: config.transport === 'stdio' ? config.args : undefined,
    headers: config.transport === 'http' && config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined,
    env:
      config.transport === 'stdio' && config.apiKey
        ? { GITHUB_TOKEN: config.apiKey, BROWSER_API_KEY: config.apiKey, LARK_MCP_TOKEN: config.apiKey }
        : undefined,
    source: isGithub ? 'github-configured' : isLark ? 'lark-configured' : 'browser-configured',
    trustClass: 'official',
    dataScope: isGithub
      ? 'repos, pull requests, issues and workflows'
      : isLark
        ? 'lark chats, users, docs and message targets'
        : 'browser sessions, screenshots and replay data',
    writeScope: isGithub
      ? 'repository operations after approval'
      : isLark
        ? 'send messages and write chat artifacts after approval'
        : 'browser actions after approval',
    installationMode: 'configured',
    allowedProfiles: ['platform', 'company', 'personal', 'cli']
  });

  const capabilities: RegisteredCapabilityTemplate[] = isGithub
    ? [
        {
          id: `${serverId}:github.search_repos`,
          toolName: 'github.search_repos',
          displayName: 'GitHub Search Repos',
          riskLevel: 'low',
          requiresApproval: false,
          category: 'knowledge',
          dataScope: 'repository metadata',
          writeScope: 'none'
        },
        {
          id: `${serverId}:github.list_pull_requests`,
          toolName: 'github.list_pull_requests',
          displayName: 'GitHub List Pull Requests',
          riskLevel: 'low',
          requiresApproval: false,
          category: 'knowledge',
          dataScope: 'pull request metadata',
          writeScope: 'none'
        },
        {
          id: `${serverId}:github.create_issue_comment`,
          toolName: 'github.create_issue_comment',
          displayName: 'GitHub Create Issue Comment',
          riskLevel: 'high',
          requiresApproval: true,
          category: 'action',
          dataScope: 'repository issues',
          writeScope: 'issue comments'
        }
      ]
    : isLark
      ? [
          {
            id: `${serverId}:lark.send_message`,
            toolName: 'lark.send_message',
            displayName: 'Lark Send Message',
            riskLevel: 'high',
            requiresApproval: true,
            category: 'action',
            dataScope: 'lark chats and recipients',
            writeScope: 'message sending'
          },
          {
            id: `${serverId}:lark.search_docs`,
            toolName: 'lark.search_docs',
            displayName: 'Lark Search Docs',
            riskLevel: 'low',
            requiresApproval: false,
            category: 'knowledge',
            dataScope: 'lark docs and wiki',
            writeScope: 'none'
          },
          {
            id: `${serverId}:lark.list_chats`,
            toolName: 'lark.list_chats',
            displayName: 'Lark List Chats',
            riskLevel: 'low',
            requiresApproval: false,
            category: 'knowledge',
            dataScope: 'lark chats',
            writeScope: 'none'
          }
        ]
      : [
          {
            id: `${serverId}:browser.open_page`,
            toolName: 'browser.open_page',
            displayName: 'Browser Open Page',
            riskLevel: 'medium',
            requiresApproval: false,
            category: 'action',
            dataScope: 'browser session data',
            writeScope: 'browser navigation'
          },
          {
            id: `${serverId}:browser.capture_screenshot`,
            toolName: 'browser.capture_screenshot',
            displayName: 'Browser Capture Screenshot',
            riskLevel: 'medium',
            requiresApproval: false,
            category: 'knowledge',
            dataScope: 'page screenshots',
            writeScope: 'artifact generation'
          },
          {
            id: `${serverId}:browser.extract_dom`,
            toolName: 'browser.extract_dom',
            displayName: 'Browser Extract DOM',
            riskLevel: 'medium',
            requiresApproval: false,
            category: 'knowledge',
            dataScope: 'page DOM',
            writeScope: 'none'
          }
        ];

  for (const capability of capabilities) {
    context.mcpCapabilityRegistry.register({
      ...capability,
      serverId
    });
  }
}

export function registerDiscoveredCapabilities(context: RuntimeConnectorRegistryContext, connectorId: string) {
  const server = context.mcpClientManager.describeServers().find(item => item.id === connectorId);
  if (!server?.discoveredCapabilities?.length) {
    return;
  }

  const existingToolNames = new Set(
    context.mcpCapabilityRegistry.listByServer(connectorId).map(capability => capability.toolName)
  );

  for (const toolName of server.discoveredCapabilities) {
    if (existingToolNames.has(toolName)) {
      continue;
    }
    const capability: McpCapabilityRegistryRecord = {
      id: `${connectorId}:${toolName}`,
      toolName,
      serverId: connectorId,
      displayName: toCapabilityDisplayName(toolName),
      riskLevel: inferCapabilityRiskLevel(toolName),
      requiresApproval: inferCapabilityRequiresApproval(toolName),
      category: inferCapabilityCategory(toolName),
      dataScope: server.dataScope,
      writeScope: inferCapabilityRequiresApproval(toolName) ? (server.writeScope ?? 'connector action') : 'none'
    };
    context.mcpCapabilityRegistry.register(capability);
  }
}

export function getDisabledCompanyWorkerIds(context: RuntimeConnectorRegistryContext): string[] {
  return context.orchestrator
    .listWorkers()
    .filter(worker => worker.kind === 'company')
    .filter(worker => !context.orchestrator.isWorkerEnabled?.(worker.id))
    .map(worker => worker.id);
}

export function registerInstalledSkillWorker(context: RuntimeConnectorRegistryContext, skill: SkillCard): void {
  const roleModels =
    'routing' in context.settings
      ? resolveActiveRoleModels(context.settings as RuntimeSettings)
      : context.settings.zhipuModels;
  if (!roleModels) {
    return;
  }
  context.orchestrator.registerWorker({
    id: `installed-skill:${skill.id}`,
    ministry: resolveInstalledSkillMinistry(skill),
    kind: 'installed-skill',
    displayName: `${skill.name} 已安装技能`,
    defaultModel: resolveInstalledSkillModel(roleModels, skill),
    supportedCapabilities: skill.requiredCapabilities ?? skill.requiredTools,
    reviewPolicy: 'self-check',
    sourceId: skill.sourceId,
    owner: 'skill-lab',
    tags: buildInstalledSkillTags(skill),
    requiredConnectors: skill.requiredConnectors,
    preferredContexts: skill.applicableGoals
  });
}

export function listSkillSourcesSnapshot(settings: RuntimeConnectorRegistryContext['settings']) {
  return [
    {
      id: 'workspace-skills',
      name: 'Workspace Skills',
      kind: 'internal' as const,
      baseUrl: join(settings.workspaceRoot, 'skills'),
      discoveryMode: 'local-dir' as const,
      syncStrategy: 'manual' as const,
      allowedProfiles: ['platform', 'company', 'personal', 'cli'] as const,
      trustClass: 'internal' as const,
      priority: 'workspace/internal' as const,
      enabled: true,
      healthState: 'healthy' as const,
      profilePolicy: describeSkillSourceProfilePolicy(
        'workspace-skills',
        settings.profile as never,
        settings.policy.sourcePolicyMode as never
      )
    },
    {
      id: 'managed-local-skills',
      name: 'Managed Local Skills',
      kind: 'internal' as const,
      baseUrl: settings.skillsRoot,
      discoveryMode: 'local-dir' as const,
      syncStrategy: 'manual' as const,
      allowedProfiles: ['platform', 'company', 'personal', 'cli'] as const,
      trustClass: 'internal' as const,
      priority: 'managed/local' as const,
      enabled: true,
      healthState: 'healthy' as const,
      profilePolicy: describeSkillSourceProfilePolicy(
        'managed-local-skills',
        settings.profile as never,
        settings.policy.sourcePolicyMode as never
      )
    },
    {
      id: 'bundled-marketplace',
      name: 'Bundled Marketplace',
      kind: 'marketplace' as const,
      baseUrl: settings.skillSourcesRoot,
      discoveryMode: 'remote-index' as const,
      indexUrl: join(settings.skillSourcesRoot, 'index.json'),
      packageBaseUrl: settings.skillSourcesRoot,
      syncStrategy: 'on-demand' as const,
      allowedProfiles: ['platform', 'personal', 'cli'] as const,
      trustClass: 'curated' as const,
      priority: 'bundled/marketplace' as const,
      enabled: describeSkillSourceProfilePolicy(
        'bundled-marketplace',
        settings.profile as never,
        settings.policy.sourcePolicyMode as never
      ).enabledByProfile,
      healthState: 'healthy' as const,
      profilePolicy: describeSkillSourceProfilePolicy(
        'bundled-marketplace',
        settings.profile as never,
        settings.policy.sourcePolicyMode as never
      )
    }
  ];
}
