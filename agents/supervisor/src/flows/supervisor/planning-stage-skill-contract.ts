import type { ManagerPlan } from '@agent/core';
import { AgentRole } from './supervisor-architecture-helpers';

interface SkillContractTaskLike {
  capabilityAttachments?: Array<{
    id: string;
    kind: string;
    enabled?: boolean;
    displayName: string;
    sourceId?: string;
    owner: {
      ownerType: string;
    };
    metadata?: {
      steps?: Array<{
        title: string;
        instruction: string;
        toolNames?: string[];
      }>;
      requiredConnectors?: string[];
      approvalSensitiveTools?: string[];
    };
  }>;
  requestedHints?: {
    requestedSkill?: string;
  };
}

export function compileSkillContractIntoPlan(task: SkillContractTaskLike, plan: ManagerPlan): ManagerPlan {
  const attachment = resolveCompiledSkillAttachment(task);
  const skillSteps = attachment?.metadata?.steps ?? [];
  if (!attachment || skillSteps.length === 0) {
    return plan;
  }

  const compiledSteps = skillSteps.map((step, index) => `${index + 1}. ${step.title}: ${step.instruction}`);
  const connectorHint = attachment.metadata?.requiredConnectors?.length
    ? `依赖连接器：${attachment.metadata.requiredConnectors.join('、')}`
    : undefined;
  const summary = [plan.summary, `已挂载技能：${attachment.displayName}。`, connectorHint].filter(Boolean).join(' ');

  return {
    ...plan,
    summary,
    steps: Array.from(new Set([...plan.steps, ...compiledSteps])),
    subTasks: [
      ...plan.subTasks.map(subTask => ({
        ...subTask,
        description: augmentSubTaskDescription(subTask.description, subTask.assignedTo, attachment)
      })),
      ...buildSkillContractSubTasks(attachment)
    ]
  };
}

export function resolveCompiledSkillAttachment(task: SkillContractTaskLike) {
  const attachments = task.capabilityAttachments ?? [];
  const requestedSkill = task.requestedHints?.requestedSkill?.toLowerCase();
  return (
    attachments.find(
      attachment =>
        attachment.kind === 'skill' &&
        attachment.enabled &&
        Boolean(attachment.metadata?.steps?.length) &&
        requestedSkill &&
        (`${attachment.displayName} ${attachment.sourceId ?? ''}`.toLowerCase().includes(requestedSkill) ||
          attachment.id.toLowerCase().includes(requestedSkill))
    ) ??
    attachments.find(
      attachment =>
        attachment.kind === 'skill' &&
        attachment.enabled &&
        attachment.owner.ownerType === 'user-attached' &&
        Boolean(attachment.metadata?.steps?.length)
    )
  );
}

function buildSkillContractSubTasks(attachment: NonNullable<ReturnType<typeof resolveCompiledSkillAttachment>>) {
  const steps = attachment.metadata?.steps ?? [];
  return steps.map((step, index) => {
    const assignedTo = resolveSkillStepAssignee(step.toolNames ?? []);
    return {
      id: buildSkillSubTaskId(attachment.id, assignedTo, index + 1),
      title: `${attachment.displayName} · ${step.title}`,
      description: step.instruction,
      assignedTo,
      status: 'pending' as const
    };
  });
}

function buildSkillSubTaskId(attachmentId: string, assignedTo: AgentRole, stepIndex: number) {
  return `skill_step:${attachmentId}:${assignedTo}:${stepIndex}`;
}

function resolveSkillStepAssignee(toolNames: string[]) {
  const normalizedTools = toolNames.map(item => item.toLowerCase());
  if (normalizedTools.some(item => /(review|approval|security|compliance|audit)/.test(item))) {
    return AgentRole.REVIEWER;
  }
  if (normalizedTools.some(item => /(write|send|run|ship|open|browser|github|lark|http)/.test(item))) {
    return AgentRole.EXECUTOR;
  }
  return AgentRole.RESEARCH;
}

function augmentSubTaskDescription(
  description: string,
  assignedTo: AgentRole,
  attachment: NonNullable<ReturnType<typeof resolveCompiledSkillAttachment>>
) {
  const steps = attachment.metadata?.steps ?? [];
  if (!steps.length) {
    return description;
  }

  const relevantSteps = steps.filter(step => {
    const normalizedTools = (step.toolNames ?? []).map(item => item.toLowerCase());
    if (assignedTo === AgentRole.RESEARCH) {
      return (
        normalizedTools.length === 0 || normalizedTools.some(item => /(search|read|browse|doc|memory|web)/.test(item))
      );
    }
    if (assignedTo === AgentRole.EXECUTOR) {
      return (
        normalizedTools.length === 0 ||
        normalizedTools.some(item => /(write|send|run|ship|open|browser|github|lark|http)/.test(item))
      );
    }
    if (assignedTo === AgentRole.REVIEWER) {
      return (
        normalizedTools.length === 0 ||
        normalizedTools.some(item => /(review|approval|security|compliance|audit)/.test(item)) ||
        (attachment.metadata?.approvalSensitiveTools?.length ?? 0) > 0
      );
    }
    return false;
  });

  if (!relevantSteps.length) {
    return description;
  }

  return `${description}\n技能步骤：${relevantSteps.map(step => `${step.title}(${step.instruction})`).join('；')}`;
}
