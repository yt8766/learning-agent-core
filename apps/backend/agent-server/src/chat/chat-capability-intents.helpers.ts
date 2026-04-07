import type { ConfigureConnectorDto } from '@agent/shared';

export type CapabilityIntent =
  | { kind: 'none' }
  | { kind: 'list-capabilities' }
  | { kind: 'list-tools' }
  | { kind: 'list-skills' }
  | { kind: 'list-connectors' }
  | { kind: 'install-skill'; repo: string; skillName?: string }
  | { kind: 'create-skill'; description: string; displayName?: string }
  | {
      kind: 'use-connector';
      connectorQuery: string;
      label: string;
      templateId: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
    };

export function resolveCapabilityIntent(message: string): CapabilityIntent {
  const raw = message.trim();
  const normalized = raw.toLowerCase();
  const asksWhatToolsAreAvailable =
    /(我)?现在有(什么|哪些).*(tools?|工具)/i.test(raw) ||
    /(当前|现在).*(有什么|有哪些|能用什么|可用什么).*(tools?|工具)/i.test(raw) ||
    /(能用|可用).*(tools?|工具)/i.test(raw);
  const asksWhatSkillsAreAvailable =
    /(我)?现在有(什么|哪些).*(skills?|技能)/i.test(raw) ||
    /(当前|现在).*(有什么|有哪些|能用什么|可用什么).*(skills?|技能)/i.test(raw);
  const asksWhatConnectorsAreAvailable =
    /(我)?现在有(什么|哪些).*(mcp|connectors?|连接器)/i.test(raw) ||
    /(当前|现在).*(有什么|有哪些|能用什么|可用什么).*(mcp|connectors?|连接器)/i.test(raw);
  if (
    ((/(我现在有哪些|当前有哪些|列出|看看)/i.test(raw) ||
      /(what|list|show)/i.test(normalized) ||
      asksWhatToolsAreAvailable ||
      asksWhatSkillsAreAvailable ||
      asksWhatConnectorsAreAvailable) &&
      /(tools?|skills?|mcp|connectors?|技能|连接器)/i.test(raw)) ||
    /(tools?|skills?|mcp|connectors?)\s*\/\s*(tools?|skills?|mcp|connectors?)/i.test(normalized)
  ) {
    const hasTools = /(tools?|工具)/i.test(raw);
    const hasSkills = /(skills?|技能)/i.test(raw);
    const hasConnectors = /(mcp|connectors?|连接器)/i.test(raw);
    if ((hasTools && hasSkills) || (hasTools && hasConnectors) || (hasSkills && hasConnectors)) {
      return { kind: 'list-capabilities' };
    }
  }
  if (
    /(我现在有哪些|当前有哪些|列出|看看).*(tools?|工具)/i.test(raw) ||
    asksWhatToolsAreAvailable ||
    /(what|list|show).*(tools?)/i.test(normalized)
  ) {
    return { kind: 'list-tools' };
  }
  if (
    /(我现在有哪些|当前有哪些|列出|看看).*(skills?|技能)/i.test(raw) ||
    asksWhatSkillsAreAvailable ||
    /(what|list|show).*(skills?)/i.test(normalized)
  ) {
    return { kind: 'list-skills' };
  }
  if (
    /(我现在有哪些|当前有哪些|列出|看看).*(mcp|connectors?|连接器)/i.test(raw) ||
    asksWhatConnectorsAreAvailable ||
    /(what|list|show).*(mcp|connectors?)/i.test(normalized)
  ) {
    return { kind: 'list-connectors' };
  }
  const installSkillTarget = extractRemoteSkillInstallTarget(raw);
  if (installSkillTarget) {
    return {
      kind: 'install-skill',
      repo: installSkillTarget.repo,
      skillName: installSkillTarget.skillName
    };
  }
  if (isCreateSkillIntent(raw)) {
    const description =
      raw
        .replace(/^(帮我|请)?(创建|生成|做一个|做个|create)\s*/i, '')
        .replace(/(一个|一个我自己的)?\s*(skill|技能)\s*/gi, '')
        .trim() || raw;
    return { kind: 'create-skill', description, displayName: extractQuotedName(raw) };
  }
  if (/(用|使用|配置|接入|连接).*(github|browser|lark).*(mcp|connector)/i.test(raw)) {
    const connectorQuery = /github/i.test(raw) ? 'github' : /browser/i.test(raw) ? 'browser' : 'lark';
    return {
      kind: 'use-connector',
      connectorQuery,
      label: connectorQuery === 'github' ? 'GitHub MCP' : connectorQuery === 'browser' ? 'Browser MCP' : 'Lark MCP',
      templateId:
        connectorQuery === 'github'
          ? 'github-mcp-template'
          : connectorQuery === 'browser'
            ? 'browser-mcp-template'
            : 'lark-mcp-template'
    };
  }
  return { kind: 'none' };
}

export function buildSkillCatalogSummary(skillCount: number, bootstrapCount: number) {
  return `当前可见 ${skillCount} 个运行时 skill，另有 ${bootstrapCount} 个 Bootstrap Skills 常驻注入。`;
}

export function buildToolsCatalogSummary(toolsCenter: {
  totalTools: number;
  families: Array<{ displayName?: string; id: string; toolCount?: number }>;
  tools: Array<{ isReadOnly?: boolean; requiresApproval?: boolean }>;
  approvalRequiredCount?: number;
}) {
  if (toolsCenter.totalTools <= 0) {
    return '当前还没有可见工具。';
  }

  const readonlyCount = toolsCenter.tools.filter(tool => tool.isReadOnly).length;
  const approvalCount =
    toolsCenter.approvalRequiredCount ?? toolsCenter.tools.filter(tool => tool.requiresApproval).length;
  const familyPreview = toolsCenter.families
    .slice(0, 4)
    .map(family => family.displayName ?? family.id)
    .join('、');
  const extraFamilyCount = Math.max(0, toolsCenter.families.length - 4);
  const familyText = extraFamilyCount > 0 ? `${familyPreview} 等 ${toolsCenter.families.length} 类` : familyPreview;
  const parts = [
    `当前可见 ${toolsCenter.totalTools} 个工具`,
    familyText ? `主要包括 ${familyText}` : undefined,
    readonlyCount > 0 ? `${readonlyCount} 个只读工具可直接使用` : undefined,
    approvalCount > 0 ? `${approvalCount} 个高风险工具默认需要审批` : '当前未发现默认需审批的工具'
  ].filter(Boolean);
  return `${parts.join('，')}。`;
}

export function groupSkillCards(skills: Array<any>) {
  const grouped = new Map<string, Array<any>>();
  for (const skill of skills) {
    const ownerType = skill.bootstrap ? 'shared' : (skill.ownership?.ownerType ?? deriveSkillOwnerType(skill));
    const label =
      ownerType === 'shared'
        ? 'Shared Skills'
        : ownerType === 'ministry-owned'
          ? 'Ministry-owned'
          : ownerType === 'specialist-owned'
            ? 'Specialist-owned'
            : ownerType === 'runtime-derived'
              ? 'Runtime-derived'
              : 'User-attached';
    const bucket = grouped.get(label) ?? [];
    bucket.push({
      id: skill.id,
      displayName: skill.name,
      summary: skill.description,
      ownerType,
      scope: skill.ownership?.scope ?? 'workspace',
      sourceLabel: skill.sourceId,
      bootstrap: skill.bootstrap,
      enabled: skill.status !== 'disabled',
      status: skill.status
    });
    grouped.set(label, bucket);
  }
  return Array.from(grouped.entries()).map(([label, items]) => ({
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    label,
    kind: 'skill' as const,
    items
  }));
}

export function buildDefaultConnectorConfig(
  templateId: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template',
  rawMessage?: string
): ConfigureConnectorDto {
  if (templateId === 'github-mcp-template') {
    return {
      templateId,
      transport: 'stdio',
      displayName: 'GitHub MCP',
      command: 'npx',
      args: ['-y', 'github-mcp-server'],
      actor: 'agent-chat-user',
      enabled: true
    };
  }
  if (templateId === 'lark-mcp-template') {
    const parsed = parseLarkConnectorHints(rawMessage);
    const endpoint = parsed.endpoint ?? process.env.LARK_MCP_ENDPOINT?.trim();
    const apiKey = parsed.apiKey ?? process.env.LARK_MCP_TOKEN?.trim();
    return {
      templateId,
      transport: 'http',
      displayName: 'Lark MCP',
      endpoint,
      apiKey,
      actor: 'agent-chat-user',
      enabled: Boolean(endpoint && apiKey)
    };
  }
  return {
    templateId,
    transport: 'stdio',
    displayName: 'Browser MCP',
    command: 'npx',
    args: ['-y', 'browserbase-mcp'],
    actor: 'agent-chat-user',
    enabled: true
  };
}

export function buildTemplatePlaceholder(intent: { connectorQuery: string; label: string }) {
  return {
    id: `${intent.connectorQuery}-mcp-template`,
    displayName: intent.label,
    summary: `当前还没有配置好的 ${intent.label}，建议先在 Connector & Policy Center 完成配置。`
  };
}

function deriveSkillOwnerType(skill: any) {
  return skill.installReceiptId ? 'runtime-derived' : 'user-attached';
}

function extractQuotedName(message: string) {
  const match = message.match(/[“"']([^”"']+)[”"']/);
  return match?.[1]?.trim();
}

function isCreateSkillIntent(message: string) {
  const compact = message.replace(/\s+/g, ' ').trim();
  return /(帮我|请)?(创建|生成|做一个|做个|create)\s*(一个|个|一套|一个我自己的)?[\s\S]{0,40}(skill|技能)\b/i.test(
    compact
  );
}

function extractRemoteSkillInstallTarget(message: string) {
  const raw = message.trim();
  if (
    !/(安装|添加|加上|装上|启用|install|add)/i.test(raw) ||
    !/(skill|技能|skills?\.sh|npx skills add|[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i.test(raw)
  ) {
    return undefined;
  }

  const commandMatch = raw.match(/npx\s+skills\s+add\s+([^\s]+)(?:\s+--skill\s+([^\s]+))?/i);
  if (commandMatch) {
    return {
      repo: normalizeRemoteSkillRepo(commandMatch[1]!),
      skillName: commandMatch[2]?.trim()
    };
  }

  const githubMatch = raw.match(/https?:\/\/github\.com\/([^/\s]+\/[^/\s]+)(?:\/|$)/i);
  if (githubMatch) {
    return {
      repo: githubMatch[1]!.trim()
    };
  }

  const repoMatch = raw.match(/\b([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\b(?:@([A-Za-z0-9_.-]+))?/);
  if (repoMatch) {
    return {
      repo: repoMatch[1]!.trim(),
      skillName: repoMatch[2]?.trim()
    };
  }

  return undefined;
}

function normalizeRemoteSkillRepo(value: string) {
  const normalized = value.trim();
  const [repo] = normalized.split('@');
  return repo?.replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '') ?? normalized;
}

function parseLarkConnectorHints(rawMessage?: string) {
  const message = rawMessage ?? '';
  const endpoint =
    message.match(/https?:\/\/[^\s"'”]+/i)?.[0]?.trim() ?? message.match(/endpoint[:：=]\s*([^\s"'”]+)/i)?.[1]?.trim();
  const apiKey =
    message.match(/token[:：=]\s*([A-Za-z0-9._-]+)/i)?.[1]?.trim() ??
    message.match(/api[_-\s]?key[:：=]\s*([A-Za-z0-9._-]+)/i)?.[1]?.trim();
  return { endpoint, apiKey };
}
