export type AsyncPipeline<TInput, TOutput, TContext = unknown> = (input: TInput, context: TContext) => Promise<TOutput>;
