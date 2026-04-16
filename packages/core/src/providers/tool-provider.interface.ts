export interface ToolProviderExecutionInput<TArgs = unknown> {
  toolName: string;
  args: TArgs;
  taskId?: string;
  runId?: string;
}

export interface ToolProviderExecutionResult<TResult = unknown> {
  ok: boolean;
  output?: TResult;
  error?: string;
}

export interface IToolProvider {
  readonly providerId: string;
  readonly displayName: string;
  isConfigured(): boolean;
  execute<TArgs = unknown, TResult = unknown>(
    input: ToolProviderExecutionInput<TArgs>
  ): Promise<ToolProviderExecutionResult<TResult>>;
}
