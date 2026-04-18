import type { SkillCard } from '@agent/core';
import type { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';

export type RuntimeSkillContract = {
  id: string;
  name: string;
  description?: string;
  steps: SkillCard['steps'];
  constraints: string[];
  successSignals: string[];
  requiredTools?: string[];
  requiredConnectors?: string[];
  approvalSensitiveTools?: string[];
};

export async function resolveInstalledSkillCard(context: AgentRuntimeContext): Promise<SkillCard | undefined> {
  const workerId = context.currentWorker?.id;
  if (!workerId?.startsWith('installed-skill:')) {
    return undefined;
  }
  return context.skillRegistry.getById(workerId.replace('installed-skill:', ''));
}

export function resolveRuntimeSkill(
  context: AgentRuntimeContext,
  installedSkill?: SkillCard
): RuntimeSkillContract | undefined {
  if (installedSkill) {
    return {
      id: installedSkill.id,
      name: installedSkill.name,
      description: installedSkill.description,
      steps: installedSkill.steps,
      constraints: installedSkill.constraints,
      successSignals: installedSkill.successSignals,
      requiredTools: installedSkill.requiredTools,
      requiredConnectors: installedSkill.requiredConnectors,
      approvalSensitiveTools: installedSkill.toolContract?.approvalSensitive
    };
  }
  const compiled = context.compiledSkill;
  if (!compiled) {
    return undefined;
  }
  return {
    id: compiled.id,
    name: compiled.name,
    description: compiled.description,
    steps: compiled.steps,
    constraints: compiled.constraints ?? [],
    successSignals: compiled.successSignals ?? [],
    requiredTools: compiled.requiredTools,
    requiredConnectors: compiled.requiredConnectors,
    approvalSensitiveTools: compiled.approvalSensitiveTools
  };
}

export function buildActionPrompt(
  context: AgentRuntimeContext,
  researchSummary: string,
  installedSkill: RuntimeSkillContract | undefined,
  toolName: string
) {
  const basePrompt = `目标：${context.goal}；研究摘要：${researchSummary}`;
  if (!installedSkill) {
    return basePrompt;
  }

  const matchedStep = installedSkill.steps.find(step => step.toolNames.includes(toolName)) ?? installedSkill.steps[0];
  const stepText = matchedStep ? `技能步骤：${matchedStep.title}，${matchedStep.instruction}` : '';
  const constraintText = installedSkill.constraints.length ? `约束：${installedSkill.constraints.join('；')}` : '';
  const signalText = installedSkill.successSignals.length
    ? `成功信号：${installedSkill.successSignals.join('、')}`
    : '';
  return [basePrompt, `已命中安装技能：${installedSkill.name}`, stepText, constraintText, signalText]
    .filter(Boolean)
    .join('；');
}

export function decorateExecutionSummary(summary: string, installedSkill?: RuntimeSkillContract) {
  if (!installedSkill) {
    return summary;
  }
  return `[${installedSkill.name}] ${summary}`;
}
