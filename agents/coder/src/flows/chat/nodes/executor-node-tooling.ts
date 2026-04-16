import { ActionIntent } from '@agent/shared';
import type { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import type { RuntimeSkillContract } from './executor-node-skill';

export function resolveWorkerToolAllowlist(context: AgentRuntimeContext): Set<string> | undefined {
  const capabilities = context.currentWorker?.supportedCapabilities;
  if (!capabilities?.length) {
    return undefined;
  }

  const toolNames = new Set<string>();
  for (const capability of capabilities) {
    const normalized = capability.toLowerCase();
    switch (normalized) {
      case 'search_memory':
      case 'memory':
        toolNames.add('search_memory');
        break;
      case 'read_local_file':
      case 'code-generation':
      case 'documentation':
      case 'ui-spec':
        toolNames.add('read_local_file');
        break;
      case 'list_directory':
      case 'knowledge-synthesis':
        toolNames.add('list_directory');
        toolNames.add('local-analysis');
        toolNames.add('find-skills');
        toolNames.add('webSearchPrime');
        toolNames.add('webReader');
        toolNames.add('search_doc');
        toolNames.add('collect_research_source');
        break;
      case 'write_local_file':
      case 'refactor':
        toolNames.add('write_local_file');
        break;
      case 'delete_local_file':
      case 'delete':
      case 'cleanup':
        toolNames.add('delete_local_file');
        break;
      case 'schedule_task':
      case 'schedule':
      case 'cron':
      case 'timer':
        toolNames.add('schedule_task');
        break;
      case 'http_request':
      case 'release-ops':
        toolNames.add('http_request');
        toolNames.add('ship_release');
        break;
      case 'terminal':
      case 'sandbox':
        toolNames.add('run_terminal');
        break;
      case 'review':
      case 'security-scan':
      case 'compliance':
        toolNames.add('local-analysis');
        toolNames.add('read_local_file');
        break;
      default:
        if (normalized.includes('browse') || normalized.includes('browser')) {
          toolNames.add('browse_page');
        }
        if (normalized.includes('openapi') || normalized.includes('docs')) {
          toolNames.add('read_local_file');
          toolNames.add('local-analysis');
        }
        if (normalized.includes('skill')) {
          toolNames.add('find-skills');
        }
        if (normalized.includes('knowledge')) {
          toolNames.add('search_memory');
          toolNames.add('webSearchPrime');
          toolNames.add('webReader');
          toolNames.add('search_doc');
          toolNames.add('collect_research_source');
        }
        if (normalized.includes('web') || normalized.includes('search')) {
          toolNames.add('webSearchPrime');
          toolNames.add('webReader');
        }
        break;
    }
  }

  return toolNames.size ? toolNames : undefined;
}

export function selectIntent(goal: string): ActionIntent {
  const normalizedGoal = goal.toLowerCase();
  if (
    normalizedGoal.includes('delete') ||
    normalizedGoal.includes('remove') ||
    normalizedGoal.includes('cleanup') ||
    normalizedGoal.includes('清理') ||
    normalizedGoal.includes('删除')
  ) {
    return ActionIntent.DELETE_FILE;
  }
  if (
    normalizedGoal.includes('schedule') ||
    normalizedGoal.includes('cron') ||
    normalizedGoal.includes('timer') ||
    normalizedGoal.includes('定时') ||
    normalizedGoal.includes('提醒')
  ) {
    return ActionIntent.SCHEDULE_TASK;
  }
  if (
    normalizedGoal.includes('write') ||
    normalizedGoal.includes('save') ||
    normalizedGoal.includes('file') ||
    normalizedGoal.includes('fix') ||
    normalizedGoal.includes('patch') ||
    normalizedGoal.includes('edit') ||
    normalizedGoal.includes('修改') ||
    normalizedGoal.includes('修复') ||
    normalizedGoal.includes('更新')
  ) {
    return ActionIntent.WRITE_FILE;
  }
  if (normalizedGoal.includes('http') || normalizedGoal.includes('api') || normalizedGoal.includes('request')) {
    return ActionIntent.CALL_EXTERNAL_API;
  }
  return ActionIntent.READ_FILE;
}

export function buildToolInput(
  context: AgentRuntimeContext,
  toolName: string,
  actionPrompt: string,
  researchSummary: string,
  installedSkill?: RuntimeSkillContract
): Record<string, unknown> {
  const preferredResearchSource = selectPreferredResearchSource(context);
  const skillEnvelope = installedSkill
    ? {
        skillId: installedSkill.id,
        skillName: installedSkill.name,
        successSignals: installedSkill.successSignals,
        constraints: installedSkill.constraints
      }
    : undefined;

  switch (toolName) {
    case 'read_local_file':
      return { path: 'package.json', goal: context.goal, researchSummary, actionPrompt, skill: skillEnvelope };
    case 'list_directory':
      return { path: '.', goal: context.goal, researchSummary, actionPrompt, skill: skillEnvelope };
    case 'write_local_file':
      return {
        path: 'data/generated/executor-output.txt',
        content: `目标：${context.goal}\n研究摘要：${researchSummary}\n动作：${actionPrompt}`,
        skill: skillEnvelope
      };
    case 'delete_local_file':
      return {
        path: 'data/generated/executor-output.txt',
        recursive: false,
        goal: context.goal,
        researchSummary,
        actionPrompt,
        skill: skillEnvelope
      };
    case 'schedule_task':
      return {
        name: 'runtime-followup',
        prompt: actionPrompt,
        schedule: 'manual',
        status: 'ACTIVE',
        cwd: '.',
        goal: context.goal,
        researchSummary,
        actionPrompt,
        skill: skillEnvelope
      };
    case 'http_request':
      return {
        url: 'https://example.com',
        method: 'GET',
        goal: context.goal,
        researchSummary,
        actionPrompt,
        skill: skillEnvelope
      };
    case 'webSearchPrime':
      return {
        query: context.goal,
        goal: context.goal,
        researchSummary,
        actionPrompt,
        freshnessHint: isLikelyFreshnessSensitive(context.goal) ? 'latest' : 'general',
        skill: skillEnvelope
      };
    case 'webReader':
      return {
        url: preferredResearchSource?.sourceUrl ?? buildSearchUrl(context.goal),
        goal: context.goal,
        researchSummary,
        actionPrompt,
        skill: skillEnvelope
      };
    case 'search_doc':
      return {
        repoUrl: preferredResearchSource?.sourceUrl ?? 'https://github.com/',
        query: context.goal,
        goal: context.goal,
        researchSummary,
        actionPrompt,
        skill: skillEnvelope
      };
    case 'collect_research_source':
      return {
        url: preferredResearchSource?.sourceUrl ?? buildSearchUrl(context.goal),
        goal: context.goal,
        researchSummary,
        actionPrompt,
        trustClass: preferredResearchSource?.trustClass ?? 'official',
        sourceType: preferredResearchSource?.sourceType ?? 'web',
        skill: skillEnvelope
      };
    case 'browse_page':
      return {
        url: preferredResearchSource?.sourceUrl ?? buildSearchUrl(context.goal),
        goal: context.goal,
        researchSummary,
        actionPrompt,
        skill: skillEnvelope
      };
    case 'run_terminal': {
      const command = installedSkill?.successSignals.some(signal => signal.toLowerCase().includes('ship'))
        ? 'pnpm build:lib'
        : 'pnpm exec vitest --help';
      return { command, goal: context.goal, researchSummary, actionPrompt, skill: skillEnvelope };
    }
    case 'find-skills':
      return { goal: context.goal, limit: 8, researchSummary, actionPrompt, skill: skillEnvelope };
    case 'ship_release':
      return { target: 'main', goal: context.goal, researchSummary, actionPrompt, skill: skillEnvelope };
    default:
      return { goal: context.goal, researchSummary, actionPrompt, skill: skillEnvelope };
  }
}

export function buildApprovalPreview(toolName: string, input: Record<string, unknown>) {
  const preview = [
    typeof input.command === 'string' ? { label: 'Command', value: input.command } : null,
    typeof input.path === 'string' ? { label: 'Path', value: input.path } : null,
    typeof input.schedule === 'string' ? { label: 'Schedule', value: input.schedule } : null,
    typeof input.url === 'string' ? { label: 'URL', value: input.url } : null,
    typeof input.target === 'string' ? { label: 'Target', value: input.target } : null,
    typeof input.method === 'string' ? { label: 'Method', value: input.method } : null,
    typeof input.actionPrompt === 'string' ? { label: 'Action', value: input.actionPrompt } : null,
    !('command' in input) && !('path' in input) && !('url' in input) && !('target' in input)
      ? { label: 'Tool', value: toolName }
      : null
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return preview.slice(0, 4);
}

export function selectPreferredToolNameByWorkflow(context: AgentRuntimeContext): string | undefined {
  switch (context.workflowPreset?.id) {
    case 'browse':
      return selectPreferredBrowseToolName(context);
    case 'ship':
      return 'ship_release';
    case 'qa':
      return 'run_terminal';
    default:
      return undefined;
  }
}

function selectPreferredResearchSource(context: AgentRuntimeContext) {
  const candidates = (context.externalSources ?? []).filter(source => source.sourceUrl);
  return (
    candidates.find(source => source.sourceType === 'web_research_plan') ??
    candidates.find(source => source.trustClass === 'official') ??
    candidates[0]
  );
}

function selectPreferredBrowseToolName(context: AgentRuntimeContext) {
  const preferredSource = selectPreferredResearchSource(context);
  const sourceUrl = preferredSource?.sourceUrl?.toLowerCase();

  if (sourceUrl?.includes('github.com') && context.mcpClientManager?.hasCapability('search_doc')) {
    return 'search_doc';
  }
  if (sourceUrl && context.mcpClientManager?.hasCapability('webReader')) {
    return 'webReader';
  }
  if (context.mcpClientManager?.hasCapability('webSearchPrime')) {
    return 'webSearchPrime';
  }
  return context.toolRegistry.get('webSearchPrime') ? 'webSearchPrime' : 'collect_research_source';
}

function buildSearchUrl(goal: string) {
  return `https://www.bing.com/search?q=${encodeURIComponent(goal.trim() || '智能搜索')}`;
}

function isLikelyFreshnessSensitive(goal: string) {
  return /(最新|最近|today|latest|recent|本周|今天|近况)/i.test(goal);
}
