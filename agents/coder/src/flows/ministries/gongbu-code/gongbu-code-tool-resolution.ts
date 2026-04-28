import { ActionIntent } from '@agent/core';

import type { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import { isToolAllowedInExecutionMode } from '../../../capabilities/execution-mode-guard';
import type { GongbuExecutionSelection } from './gongbu-code-selection-service';
import { buildScaffoldWorkflowToolInput, resolveScaffoldToolName } from './gongbu-code-scaffold';
import type { ToolDefinition } from '@agent/runtime';

type ActionIntentValue = (typeof ActionIntent)[keyof typeof ActionIntent];

export function selectGongbuIntent(goal: string): ActionIntentValue {
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

export function buildGongbuToolInput(
  context: AgentRuntimeContext,
  toolName: string,
  actionPrompt: string,
  researchSummary: string,
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  const preferredResearchSource = selectPreferredResearchSource(context);
  switch (toolName) {
    case 'read_local_file':
      return { path: 'package.json', goal: context.goal, researchSummary, actionPrompt };
    case 'list_directory':
      return { path: '.', goal: context.goal, researchSummary, actionPrompt };
    case 'write_local_file':
      return {
        path: 'data/generated/executor-output.txt',
        content: `目标：${context.goal}\n研究摘要：${researchSummary}\n动作：${actionPrompt}`
      };
    case 'plan_data_report_structure':
      return {
        goal: context.goal,
        taskContext: context.taskContext,
        baseDir: 'src',
        ...overrides
      };
    case 'generate_data_report_module':
      return {
        goal: context.goal,
        taskContext: context.taskContext,
        baseDir: 'src',
        moduleId: overrides?.moduleId ?? 'Overview'
      };
    case 'generate_data_report_scaffold':
      return {
        goal: context.goal,
        taskContext: context.taskContext,
        baseDir: 'src',
        ...overrides
      };
    case 'generate_data_report_routes':
      return {
        blueprint: overrides?.blueprint
      };
    case 'assemble_data_report_bundle':
      return {
        blueprint: overrides?.blueprint,
        moduleResults: overrides?.moduleResults,
        sharedFiles: overrides?.sharedFiles,
        routeFiles: overrides?.routeFiles
      };
    case 'write_data_report_bundle':
      return {
        bundle: overrides?.bundle,
        targetRoot: 'data/generated/data-report-output'
      };
    case 'list_scaffold_templates':
    case 'preview_scaffold':
    case 'write_scaffold':
      return buildScaffoldWorkflowToolInput(context.goal);
    case 'delete_local_file':
      return {
        path: 'data/generated/executor-output.txt',
        recursive: false,
        goal: context.goal,
        researchSummary,
        actionPrompt
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
        actionPrompt
      };
    case 'http_request':
      return { url: 'https://example.com', method: 'GET', goal: context.goal, researchSummary, actionPrompt };
    case 'webSearchPrime':
      return {
        query: context.goal,
        goal: context.goal,
        researchSummary,
        actionPrompt,
        freshnessHint: isLikelyFreshnessSensitive(context.goal) ? 'latest' : 'general'
      };
    case 'webReader':
      return {
        url: preferredResearchSource?.sourceUrl ?? buildSearchUrl(context.goal),
        goal: context.goal,
        researchSummary,
        actionPrompt
      };
    case 'search_doc':
      return {
        repoUrl: preferredResearchSource?.sourceUrl ?? 'https://github.com/',
        query: context.goal,
        goal: context.goal,
        researchSummary,
        actionPrompt
      };
    case 'collect_research_source':
      return {
        url: preferredResearchSource?.sourceUrl ?? buildSearchUrl(context.goal),
        goal: context.goal,
        researchSummary,
        actionPrompt,
        trustClass: preferredResearchSource?.trustClass ?? 'official',
        sourceType: preferredResearchSource?.sourceType ?? 'web'
      };
    case 'browse_page':
      return {
        url: preferredResearchSource?.sourceUrl ?? buildSearchUrl(context.goal),
        goal: context.goal,
        researchSummary,
        actionPrompt
      };
    case 'run_terminal':
      return { command: 'pnpm exec vitest --help', goal: context.goal, researchSummary, actionPrompt };
    case 'ship_release':
      return { target: 'main', goal: context.goal, researchSummary, actionPrompt };
    default:
      return { goal: context.goal, researchSummary, actionPrompt };
  }
}

export function selectPreferredToolNameByWorkflow(context: AgentRuntimeContext): string | undefined {
  switch (context.workflowPreset?.id) {
    case 'browse':
      return selectPreferredBrowseToolName(context);
    case 'ship':
      return 'ship_release';
    case 'qa':
      return 'run_terminal';
    case 'data-report':
      return 'plan_data_report_structure';
    case 'scaffold':
      return resolveScaffoldToolName(context.goal);
    default:
      return undefined;
  }
}

export function selectPreferredResearchSource(context: AgentRuntimeContext) {
  const candidates = (context.externalSources ?? []).filter(source => source.sourceUrl);
  return (
    candidates.find(source => source.sourceType === 'web_research_plan') ??
    candidates.find(source => source.trustClass === 'official') ??
    candidates[0]
  );
}

export function resolveGongbuToolSelection(params: {
  context: AgentRuntimeContext;
  llmSelection: GongbuExecutionSelection | null;
  intent: ActionIntentValue;
  candidateTools: ToolDefinition[];
}): ToolDefinition | undefined {
  const { context, llmSelection, intent, candidateTools } = params;
  const allowedCapabilities = context.workflowPreset?.allowedCapabilities;
  const presetPreferredToolName = selectPreferredToolNameByWorkflow(context);
  const llmSelectedTool = llmSelection?.toolName ? context.toolRegistry.get(llmSelection.toolName) : undefined;
  const presetPreferredTool = presetPreferredToolName ? context.toolRegistry.get(presetPreferredToolName) : undefined;
  const preferredTool =
    llmSelection?.toolName &&
    (!allowedCapabilities || allowedCapabilities.includes(llmSelection.toolName)) &&
    llmSelectedTool &&
    isToolAllowedInExecutionMode(llmSelectedTool, context.executionMode)
      ? llmSelectedTool
      : undefined;
  const presetTool =
    presetPreferredToolName &&
    (!allowedCapabilities || allowedCapabilities.includes(presetPreferredToolName)) &&
    presetPreferredTool &&
    isToolAllowedInExecutionMode(presetPreferredTool, context.executionMode)
      ? presetPreferredTool
      : undefined;
  const mappedTool = context.toolRegistry.getForIntent(intent);
  const fallbackTool = candidateTools.find(tool => tool.name === 'local-analysis') ?? candidateTools[0];

  return (
    preferredTool ??
    presetTool ??
    (mappedTool &&
    (!allowedCapabilities || allowedCapabilities.includes(mappedTool.name)) &&
    isToolAllowedInExecutionMode(mappedTool, context.executionMode)
      ? mappedTool
      : undefined) ??
    fallbackTool
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
