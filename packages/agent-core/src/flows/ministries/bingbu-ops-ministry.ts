import { ActionIntent, ToolExecutionResult } from '@agent/shared';

import { GongbuCodeMinistry } from './gongbu-code-ministry';

const BINGBU_TOOL_PRIORITY = [
  'run_terminal',
  'browse_page',
  'ship_release',
  'recover_run',
  'schedule_cancel',
  'archive_thread',
  'list_runtime_artifacts'
] as const;

export class BingbuOpsMinistry extends GongbuCodeMinistry {
  protected override selectPreferredToolNameByWorkflow(): string | undefined {
    return (
      super.selectPreferredToolNameByWorkflow() ??
      BINGBU_TOOL_PRIORITY.find(toolName => this.context.toolRegistry.get(toolName))
    );
  }

  protected override buildToolInput(
    toolName: string,
    actionPrompt: string,
    researchSummary: string
  ): Record<string, unknown> {
    if (toolName === 'run_terminal') {
      return {
        command: `printf '%s\n' ${JSON.stringify(`兵部执行目标：${this.context.goal}`)}`,
        goal: this.context.goal,
        researchSummary,
        actionPrompt,
        target: 'workspace-ops'
      };
    }
    if (toolName === 'browse_page') {
      return {
        url: this.selectPreferredResearchSource()?.sourceUrl ?? 'https://example.com',
        goal: this.context.goal,
        researchSummary,
        actionPrompt,
        target: 'runtime-inspection'
      };
    }
    return super.buildToolInput(toolName, actionPrompt, researchSummary);
  }

  protected override buildApprovalPreview(toolName: string, input: Record<string, unknown>) {
    const preview = super.buildApprovalPreview(toolName, input);
    if (toolName === 'run_terminal' || toolName === 'browse_page') {
      return [{ label: 'Ops Tool', value: toolName }, ...preview].slice(0, 4);
    }
    return preview;
  }

  protected override async maybeReadSearchResult(
    toolName: string,
    executionResult: ToolExecutionResult,
    researchSummary: string,
    actionPrompt: string
  ): Promise<ToolExecutionResult> {
    if (toolName === 'browse_page' || toolName === 'run_terminal') {
      return executionResult;
    }
    return super.maybeReadSearchResult(toolName, executionResult, researchSummary, actionPrompt);
  }

  protected override async executeSingleTool(
    tool: Parameters<GongbuCodeMinistry['executeSingleTool']>[0],
    intent: ActionIntent,
    toolInput: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    const result = await super.executeSingleTool(tool, intent, toolInput);
    if (
      (tool.name === 'run_terminal' || tool.name === 'browse_page') &&
      (result.errorMessage === 'watchdog_timeout' || result.errorMessage === 'watchdog_interaction_required')
    ) {
      return {
        ...result,
        outputSummary: `兵部已暂停 ${tool.name}：检测到长任务停滞或交互阻塞，需要人工干预。${result.outputSummary}`
      };
    }
    return result;
  }
}
