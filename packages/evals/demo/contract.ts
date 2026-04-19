import { evaluateBenchmarks, evaluateExecution, evaluateSkillForPromotion } from '../src/index.js';
import * as evalsFacadeExports from '../src/contracts/evals-facade.js';
import { evaluateBenchmarks as canonicalEvaluateBenchmarks } from '../src/benchmarks/benchmarks.js';
import { evaluateExecution as canonicalEvaluateExecution } from '../src/regressions/execution-evaluator.js';
import { evaluateSkillForPromotion as canonicalEvaluateSkillForPromotion } from '../src/quality-gates/skill-promotion-gate.js';

console.log(
  JSON.stringify(
    {
      rootAligned:
        evaluateBenchmarks === canonicalEvaluateBenchmarks &&
        evaluateExecution === canonicalEvaluateExecution &&
        evaluateSkillForPromotion === canonicalEvaluateSkillForPromotion,
      contractAligned:
        evaluateBenchmarks === evalsFacadeExports.evaluateBenchmarks &&
        evaluateExecution === evalsFacadeExports.evaluateExecution &&
        evaluateSkillForPromotion === evalsFacadeExports.evaluateSkillForPromotion
    },
    null,
    2
  )
);
