import { ActionIntent, type ToolDefinition, type ToolExecutionResult } from '@agent/shared';

import type { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import type {
  ExecutionStepRecord,
  StreamingExecutionCoordinator,
  StreamingExecutionEvent
} from '../../../runtime/streaming-execution';

export function selectReadonlyBatchTools(selectedTool: ToolDefinition, candidateTools: ToolDefinition[]) {
  return [selectedTool]
    .concat(
      candidateTools.filter(
        tool =>
          tool.name !== selectedTool.name &&
          tool.isReadOnly &&
          tool.supportsStreamingDispatch &&
          [
            'read_local_file',
            'list_directory',
            'glob_workspace',
            'search_in_files',
            'read_json',
            'browse_page'
          ].includes(tool.name)
      )
    )
    .slice(0, 3);
}

export function buildReadonlyExecutionSteps(params: {
  context: AgentRuntimeContext;
  readonlyTools: ToolDefinition[];
  researchSummary: string;
  actionPrompt: string;
  source: string;
  buildToolInput: (toolName: string, actionPrompt: string, researchSummary: string) => Record<string, unknown>;
  runTool: (
    tool: ToolDefinition,
    intent: ActionIntent,
    toolInput: Record<string, unknown>
  ) => Promise<ToolExecutionResult>;
}) {
  const { context, readonlyTools, researchSummary, actionPrompt, source, buildToolInput, runTool } = params;
  return readonlyTools.map(tool => {
    const inputPreview = buildToolInput(tool.name, actionPrompt, researchSummary);
    return {
      id: `${context.taskId}:${tool.name}`,
      toolName: tool.name,
      ministry: context.currentWorker?.ministry,
      source,
      inputPreview,
      streamingEligible: tool.isReadOnly && tool.supportsStreamingDispatch,
      expectedSideEffect: tool.isReadOnly ? 'none' : 'workspace-write',
      tool,
      run: async () => runTool(tool, ActionIntent.READ_FILE, inputPreview)
    } satisfies ExecutionStepRecord<Record<string, unknown>, ToolExecutionResult>;
  });
}

export async function executeReadonlyBatch(params: {
  coordinator: StreamingExecutionCoordinator;
  context: AgentRuntimeContext;
  selectedTool: ToolDefinition;
  candidateTools: ToolDefinition[];
  researchSummary: string;
  actionPrompt: string;
  source: string;
  buildToolInput: (toolName: string, actionPrompt: string, researchSummary: string) => Record<string, unknown>;
  runTool: (
    tool: ToolDefinition,
    intent: ActionIntent,
    toolInput: Record<string, unknown>
  ) => Promise<ToolExecutionResult>;
  onEvent?: (event: StreamingExecutionEvent<ToolExecutionResult>) => void;
}): Promise<ToolExecutionResult> {
  const readonlyTools = selectReadonlyBatchTools(params.selectedTool, params.candidateTools);
  if (readonlyTools.length === 1) {
    return params.runTool(
      params.selectedTool,
      ActionIntent.READ_FILE,
      params.buildToolInput(params.selectedTool.name, params.actionPrompt, params.researchSummary)
    );
  }

  const { results, events } = await params.coordinator.run(
    buildReadonlyExecutionSteps({
      context: params.context,
      readonlyTools,
      researchSummary: params.researchSummary,
      actionPrompt: params.actionPrompt,
      source: params.source,
      buildToolInput: params.buildToolInput,
      runTool: params.runTool
    }),
    {
      shouldContinue: () => !params.context.isTaskCancelled?.(),
      allowStep: async step => !step.tool.isDestructive
    }
  );
  events.forEach(event => params.onEvent?.(event));

  return {
    ok: results.every(item => item.ok),
    outputSummary: results.map(item => item.outputSummary).join('；'),
    rawOutput: {
      batch: true,
      toolNames: readonlyTools.map(item => item.name),
      outputs: results.map(item => item.rawOutput)
    },
    exitCode: results.some(item => (item.exitCode ?? 0) !== 0) ? 1 : 0,
    durationMs: results.reduce((sum, item) => sum + item.durationMs, 0),
    errorMessage: results.find(item => item.errorMessage)?.errorMessage
  };
}
