import { EvaluationResult, ToolExecutionResult } from '@agent/core';

export interface SkillEvalResult {
  skillId: string;
  pass: boolean;
  consecutiveSuccesses: number;
  severeIncidents: number;
  notes: string[];
}

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

export function evaluateSkillForPromotion(
  skillId: string,
  consecutiveSuccesses: number,
  severeIncidents: number
): SkillEvalResult {
  const pass = consecutiveSuccesses >= 3 && severeIncidents === 0;

  return {
    skillId,
    pass,
    consecutiveSuccesses,
    severeIncidents,
    notes: pass ? ['Skill passed minimum promotion gate'] : ['Skill remains in lab until more successful evaluations']
  };
}
