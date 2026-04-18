import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { evaluateBenchmarks, evaluateExecution, evaluateSkillForPromotion } from '../src';
import * as contractEvalsFacade from '../src/contracts/evals-facade';
import { evaluateBenchmarks as canonicalEvaluateBenchmarks } from '../src/benchmarks/benchmarks';
import { evaluateExecution as canonicalEvaluateExecution } from '../src/regressions/execution-evaluator';
import { evaluateSkillForPromotion as canonicalEvaluateSkillForPromotion } from '../src/quality-gates/skill-promotion-gate';

describe('@agent/evals root exports', () => {
  it('keeps regressions, quality gates, and benchmarks wired to canonical hosts', () => {
    expect(evaluateBenchmarks).toBe(canonicalEvaluateBenchmarks);
    expect(evaluateExecution).toBe(canonicalEvaluateExecution);
    expect(evaluateSkillForPromotion).toBe(canonicalEvaluateSkillForPromotion);
  });

  it('keeps the package root aligned with the stable evals facade contract', () => {
    expect(evaluateBenchmarks).toBe(contractEvalsFacade.evaluateBenchmarks);
    expect(evaluateExecution).toBe(contractEvalsFacade.evaluateExecution);
    expect(evaluateSkillForPromotion).toBe(contractEvalsFacade.evaluateSkillForPromotion);
  });

  it('retains the evals facade contract file as a stable package export boundary', () => {
    expect(existsSync(new URL('../src/contracts/evals-facade.ts', import.meta.url))).toBe(true);
  });

  it('removes the prompt-regression compat wrapper once regressions and quality gates become canonical hosts', () => {
    expect(existsSync(new URL('../src/prompt-regression/evaluators.ts', import.meta.url))).toBe(false);
  });
});
