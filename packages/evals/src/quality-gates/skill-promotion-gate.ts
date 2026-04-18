export interface SkillEvalResult {
  skillId: string;
  pass: boolean;
  consecutiveSuccesses: number;
  severeIncidents: number;
  notes: string[];
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
