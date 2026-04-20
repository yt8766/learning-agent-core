import { ActionIntent, type AgentExecutionState, type ToolDefinition, type ToolExecutionResult } from '@agent/core';

import type { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';

type ActionIntentValue = (typeof ActionIntent)[keyof typeof ActionIntent];

export interface DataReportPipelineDeps {
  executeSingleTool(
    tool: ToolDefinition,
    intent: ActionIntentValue,
    toolInput: Record<string, unknown>
  ): Promise<ToolExecutionResult>;
  buildToolInput(
    toolName: string,
    actionPrompt: string,
    researchSummary: string,
    overrides?: Record<string, unknown>
  ): Record<string, unknown>;
}

export async function runGongbuDataReportPipeline(
  context: AgentRuntimeContext,
  state: AgentExecutionState,
  researchSummary: string,
  deps: DataReportPipelineDeps
): Promise<{
  intent: ActionIntentValue;
  toolName: string;
  requiresApproval: boolean;
  tool?: ToolDefinition;
  executionResult?: ToolExecutionResult;
  summary: string;
  approvalReason?: string;
  approvalReasonCode?: string;
  approvalPreview?: Array<{ label: string; value: string }>;
  toolInput?: Record<string, unknown>;
}> {
  const { executeSingleTool, buildToolInput } = deps;
  const intent = ActionIntent.READ_FILE;
  const stageToolNames = [
    'plan_data_report_structure',
    'generate_data_report_module',
    'generate_data_report_scaffold',
    'generate_data_report_routes',
    'assemble_data_report_bundle'
  ] as const;
  const blueprintTool = context.toolRegistry.get('plan_data_report_structure');
  const moduleTool = context.toolRegistry.get('generate_data_report_module');
  const sharedTool = context.toolRegistry.get('generate_data_report_scaffold');
  const routeTool = context.toolRegistry.get('generate_data_report_routes');
  const assembleTool = context.toolRegistry.get('assemble_data_report_bundle');

  if (!blueprintTool || !moduleTool || !sharedTool || !routeTool || !assembleTool) {
    const summary = '工部无法完成数据报表分阶段生成，缺少必要的只读工具。';
    state.status = 'failed';
    state.finalOutput = summary;
    return {
      intent,
      toolName: 'unresolved_data_report_pipeline',
      requiresApproval: false,
      summary
    };
  }

  const actionPrompt = `目标：${context.goal}；任务上下文：${context.taskContext ?? '无'}；研究摘要：${researchSummary}`;
  state.plan = ['规划报表蓝图', '按模块生成报表文件', '生成共享骨架', '生成预览路由', '组装 Sandpack 预览'];

  const blueprintResult = await executeSingleTool(
    blueprintTool,
    intent,
    buildToolInput(blueprintTool.name, actionPrompt, researchSummary)
  );
  const blueprint = blueprintResult.rawOutput as
    | {
        templateId?: string;
        moduleIds?: string[];
        modules?: Array<{ id: string }>;
      }
    | undefined;
  const moduleIds =
    blueprint?.moduleIds ?? blueprint?.modules?.map(module => module.id).filter(Boolean) ?? ([] as string[]);

  const moduleResults: ToolExecutionResult[] = [];
  for (const moduleId of moduleIds) {
    moduleResults.push(
      await executeSingleTool(
        moduleTool,
        intent,
        buildToolInput(moduleTool.name, actionPrompt, researchSummary, { moduleId })
      )
    );
  }

  const sharedResult = await executeSingleTool(
    sharedTool,
    intent,
    buildToolInput(sharedTool.name, actionPrompt, researchSummary)
  );
  const sharedFiles = Array.isArray((sharedResult.rawOutput as { files?: unknown[] } | undefined)?.files)
    ? (((sharedResult.rawOutput as { files?: unknown[] }).files ?? []) as unknown[])
    : [];
  const routeResult = await executeSingleTool(
    routeTool,
    intent,
    buildToolInput(routeTool.name, actionPrompt, researchSummary, {
      blueprint
    })
  );
  const routeFiles = Array.isArray((routeResult.rawOutput as { files?: unknown[] } | undefined)?.files)
    ? (((routeResult.rawOutput as { files?: unknown[] }).files ?? []) as unknown[])
    : [];
  const assemblyResult = await executeSingleTool(
    assembleTool,
    intent,
    buildToolInput(assembleTool.name, actionPrompt, researchSummary, {
      blueprint,
      moduleResults: moduleResults.map(item => item.rawOutput),
      sharedFiles,
      routeFiles
    })
  );

  const stageSummary = [
    blueprintResult.outputSummary,
    ...moduleResults.map(item => item.outputSummary),
    sharedResult.outputSummary,
    routeResult.outputSummary,
    assemblyResult.outputSummary
  ].join('；');
  state.toolCalls.push(...stageToolNames.map(toolName => `tool:${toolName}`));
  state.observations.push(
    `数据报表流程已完成 blueprint/module/shared/routes/assembly 五段执行。模块数：${moduleIds.length || moduleResults.length}。`
  );
  if (blueprint?.templateId) {
    state.observations.push(`模板来源：${blueprint.templateId}`);
  }
  state.shortTermMemory = [researchSummary, stageSummary];
  state.finalOutput = stageSummary;
  state.status = 'completed';

  return {
    intent,
    toolName: assembleTool.name,
    tool: assembleTool,
    requiresApproval: false,
    executionResult: assemblyResult,
    summary: assemblyResult.outputSummary
  };
}
