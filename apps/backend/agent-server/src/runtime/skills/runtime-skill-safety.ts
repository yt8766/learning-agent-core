import { listSkillSourcesSnapshot } from '../helpers/runtime-connector-registry';
import type { RuntimeSkillSourcesContext } from './runtime-skill-sources.service';

import type {
  LocalSkillSuggestionRecord,
  SkillManifestRecord,
  SkillSearchStatus,
  SkillSourceRecord
} from '@agent/shared';

export function evaluateSkillManifestSafety(
  context: RuntimeSkillSourcesContext,
  manifest?: SkillManifestRecord,
  source?: SkillSourceRecord
): NonNullable<SkillManifestRecord['safety']> {
  if (!manifest) {
    return {
      verdict: 'blocked',
      trustScore: 0,
      maxRiskLevel: 'critical',
      reasons: ['未找到 skill manifest，无法评估安全性。'],
      riskyTools: [],
      missingDeclarations: ['manifest']
    };
  }

  const toolNames = manifest.allowedTools ?? manifest.requiredCapabilities ?? [];
  const riskyToolNames = new Set<string>();
  const missingDeclarations: string[] = [];
  let maxRiskLevel: 'low' | 'medium' | 'high' | 'critical' = manifest.riskLevel;
  for (const toolName of toolNames) {
    const tool = context.toolRegistry.get(toolName);
    if (!tool) {
      missingDeclarations.push(`tool:${toolName}`);
      continue;
    }
    if (tool.riskLevel === 'critical' || tool.riskLevel === 'high') riskyToolNames.add(toolName);
    if (tool.riskLevel === 'critical') maxRiskLevel = 'critical';
    else if (tool.riskLevel === 'high' && maxRiskLevel !== 'critical') maxRiskLevel = 'high';
    else if (tool.riskLevel === 'medium' && maxRiskLevel === 'low') maxRiskLevel = 'medium';
  }

  const reasons = [
    manifest.license ? `license=${manifest.license}` : '未声明 license',
    manifest.compatibility ? `compatibility=${manifest.compatibility}` : '未声明 compatibility',
    toolNames.length ? `allowed tools=${toolNames.join(', ')}` : '未声明 allowed tools'
  ];
  if (!manifest.license) missingDeclarations.push('license');
  if (!manifest.compatibility) missingDeclarations.push('compatibility');
  if (!toolNames.length) missingDeclarations.push('allowed-tools');

  const snapshotSource = listSkillSourcesSnapshot(context.settings as any).find(item => item.id === manifest.sourceId);
  const sourceTrustClass = source?.trustClass ?? snapshotSource?.trustClass;
  const profileCompatible =
    source?.profilePolicy?.enabledByProfile ?? snapshotSource?.profilePolicy?.enabledByProfile ?? true;
  const trustClassScore =
    sourceTrustClass === 'internal'
      ? 30
      : sourceTrustClass === 'official'
        ? 24
        : sourceTrustClass === 'curated'
          ? 18
          : sourceTrustClass === 'community'
            ? 10
            : 0;
  const declarationScore = Math.max(0, 30 - missingDeclarations.length * 10);
  const riskPenalty =
    maxRiskLevel === 'critical' ? 40 : maxRiskLevel === 'high' ? 25 : maxRiskLevel === 'medium' ? 10 : 0;
  const connectorPenalty = Math.min(15, (manifest.requiredConnectors?.length ?? 0) * 5);
  const trustScore = Math.max(
    0,
    Math.min(
      100,
      trustClassScore + declarationScore + 40 - riskPenalty - connectorPenalty - (profileCompatible ? 0 : 40)
    )
  );

  if (riskyToolNames.size > 0) reasons.push(`包含高风险工具：${[...riskyToolNames].join(', ')}`);
  if (manifest.requiredConnectors?.length) reasons.push(`依赖连接器：${manifest.requiredConnectors.join(', ')}`);
  if (manifest.integrity) reasons.push(`integrity=${manifest.integrity}`);
  else {
    missingDeclarations.push('integrity');
    reasons.push('未声明 integrity');
  }
  if (sourceTrustClass) reasons.push(`source trust=${sourceTrustClass}`);
  if (!profileCompatible) reasons.push(`当前 profile=${context.settings.profile} 下该来源受限`);

  if (!profileCompatible || manifest.approvalPolicy === 'all-actions' || maxRiskLevel === 'critical') {
    return {
      verdict: 'blocked',
      trustScore,
      sourceTrustClass,
      profileCompatible,
      maxRiskLevel,
      reasons,
      riskyTools: [...riskyToolNames],
      missingDeclarations
    };
  }
  if (
    manifest.approvalPolicy === 'high-risk-only' ||
    maxRiskLevel === 'high' ||
    !manifest.license ||
    !manifest.compatibility ||
    !manifest.integrity ||
    sourceTrustClass === 'community' ||
    sourceTrustClass === 'unverified'
  ) {
    return {
      verdict: 'needs-approval',
      trustScore,
      sourceTrustClass,
      profileCompatible,
      maxRiskLevel,
      reasons,
      riskyTools: [...riskyToolNames],
      missingDeclarations
    };
  }
  return {
    verdict: 'allow',
    trustScore,
    sourceTrustClass,
    profileCompatible,
    maxRiskLevel,
    reasons,
    riskyTools: [...riskyToolNames],
    missingDeclarations
  };
}

export function buildConnectorTemplateSuggestions(goal: string): LocalSkillSuggestionRecord[] {
  const loweredGoal = goal.toLowerCase();
  const suggestions: LocalSkillSuggestionRecord[] = [];
  if (/(github|pull request|pr|issue|workflow|release)/.test(loweredGoal)) {
    suggestions.push({
      id: 'github-mcp-template',
      kind: 'connector-template',
      displayName: 'GitHub MCP Template',
      summary: '为仓库、PR、Issue、Actions 和 code security 提供受控连接能力。',
      sourceId: 'github-official-template',
      score: 0.66,
      availability: 'approval-required',
      reason: '当前任务涉及 GitHub 工作流，建议在 Connector & Policy Center 配置 GitHub MCP。',
      requiredCapabilities: ['repo', 'issues', 'pull_requests', 'actions'],
      version: 'template',
      sourceLabel: 'Official MCP Template',
      sourceTrustClass: 'official',
      installationMode: 'configured'
    });
  }
  if (/(browser|playwright|ui|页面|截图|回放)/.test(loweredGoal)) {
    suggestions.push({
      id: 'browser-mcp-template',
      kind: 'connector-template',
      displayName: 'Browser MCP Template',
      summary: '为浏览器会话、截图、抽取和回放提供模板化连接入口。',
      sourceId: 'browserbase-playwright-template',
      score: 0.6,
      availability: 'approval-required',
      reason: '当前任务涉及浏览器操作或页面证据，建议配置 Browserbase 或 Playwright MCP。',
      requiredCapabilities: ['browse_page', 'screenshot', 'replay'],
      requiredConnectors: ['browser'],
      version: 'template',
      sourceLabel: 'Official MCP Template',
      sourceTrustClass: 'official',
      installationMode: 'configured'
    });
  }
  if (/(lark|飞书|通知|消息|提醒|群消息|chat)/.test(loweredGoal)) {
    suggestions.push({
      id: 'lark-mcp-template',
      kind: 'connector-template',
      displayName: 'Lark MCP Template',
      summary: '为 Lark/飞书聊天、消息发送、文档检索和群目标定位提供模板化连接入口。',
      sourceId: 'lark-official-template',
      score: 0.64,
      availability: 'approval-required',
      reason: '当前任务涉及 Lark/飞书通知或文档查询，建议先配置 Lark MCP。',
      requiredCapabilities: ['send_message', 'search_docs', 'list_chats'],
      requiredConnectors: ['lark'],
      version: 'template',
      sourceLabel: 'Official MCP Template',
      sourceTrustClass: 'official',
      installationMode: 'configured'
    });
  }
  return suggestions;
}

export async function findAutoInstallableManifest(
  context: RuntimeSkillSourcesContext,
  suggestions: Array<LocalSkillSuggestionRecord>
) {
  const installable = suggestions.find(
    item =>
      item.kind === 'manifest' && ['installable', 'installable-local', 'installable-remote'].includes(item.availability)
  );
  if (!installable) {
    return undefined;
  }

  const { listSkillManifests } = await import('./runtime-skill-sources.service');
  const manifests = await listSkillManifests(context);
  const manifest = manifests.find(item => item.id === installable.id);
  if (!manifest) {
    return undefined;
  }

  const safety = evaluateSkillManifestSafety(context, manifest);
  if (
    safety.verdict !== 'allow' ||
    safety.trustScore < 80 ||
    !['official', 'curated', 'internal'].includes(safety.sourceTrustClass ?? '') ||
    !manifest.license
  ) {
    return undefined;
  }

  return manifest;
}

export type { SkillSearchStatus };
