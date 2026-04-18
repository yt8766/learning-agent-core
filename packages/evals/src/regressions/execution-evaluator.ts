import { EvaluationResult, ToolExecutionResult } from '@agent/core';

export function evaluateExecution(result: ToolExecutionResult): EvaluationResult {
  const success = result.ok && result.exitCode === 0;

  return {
    success,
    quality: success ? 'medium' : 'low',
    shouldRetry: !success,
    shouldWriteMemory: true,
    shouldCreateRule: !success,
    shouldExtractSkill: success,
    notes: success ? ['Execution completed in sandbox'] : ['Execution failed and should be reflected']
  };
}
