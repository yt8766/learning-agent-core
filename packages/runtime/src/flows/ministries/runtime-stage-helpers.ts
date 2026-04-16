import { AgentRole, CurrentSkillExecutionRecord, DispatchInstruction, EvidenceRecord, TaskRecord } from '@agent/shared';

import { mergeEvidence } from '@agent/shared';

type SkillStage = 'research' | 'execute';

type SkillStepTraceCallbacks = {
  addTrace: (task: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: TaskRecord, content: string, from?: AgentRole) => void;
};

function findDispatchObjective(
  dispatches: DispatchInstruction[] | undefined,
  matcher: (dispatch: DispatchInstruction) => boolean,
  fallback: string
) {
  return dispatches?.find(matcher)?.objective ?? fallback;
}

export function resolveResearchDispatchObjective(dispatches: DispatchInstruction[] | undefined) {
  return findDispatchObjective(
    dispatches,
    dispatch => dispatch.to === AgentRole.RESEARCH && dispatch.kind !== 'fallback',
    'Research shared memory and skills'
  );
}

export function resolveExecutionDispatchObjective(dispatches: DispatchInstruction[] | undefined) {
  return findDispatchObjective(
    dispatches,
    dispatch => dispatch.to === AgentRole.EXECUTOR && dispatch.kind !== 'fallback',
    'Execute the candidate action'
  );
}

export function announceSkillStep(task: TaskRecord, stage: SkillStage, callbacks: SkillStepTraceCallbacks) {
  const currentSkillExecution = buildCurrentSkillExecution(task, stage);
  task.currentSkillExecution = currentSkillExecution;
  if (!currentSkillExecution) {
    return;
  }
  setSkillStepStatus(task, stage, 'running');
  const attachment = resolveCompiledSkillAttachment(task);
  if (!attachment) {
    return;
  }
  const relevantSteps = (attachment.metadata?.steps ?? []).filter(step => {
    const toolNames = (step.toolNames ?? []).map(item => item.toLowerCase());
    if (stage === 'research') {
      return toolNames.length === 0 || toolNames.some(item => /(search|read|browse|doc|memory|web)/.test(item));
    }
    return (
      toolNames.length === 0 || toolNames.some(item => /(write|send|run|ship|open|browser|github|lark|http)/.test(item))
    );
  });
  if (!relevantSteps.length) {
    return;
  }
  callbacks.addTrace(task, 'skill_step_started', `当前进入 ${attachment.displayName} 的 ${stage} 阶段步骤。`, {
    stage,
    skillId: attachment.sourceId ?? attachment.id,
    skillDisplayName: attachment.displayName,
    currentStepIndex: currentSkillExecution.stepIndex,
    totalSteps: currentSkillExecution.totalSteps,
    currentStepTitle: currentSkillExecution.title,
    steps: relevantSteps.map(step => ({
      title: step.title,
      instruction: step.instruction,
      toolNames: step.toolNames ?? []
    }))
  });
  callbacks.addProgressDelta(
    task,
    `${attachment.displayName}：${relevantSteps.map(step => step.title).join('、')}`,
    stage === 'research' ? AgentRole.RESEARCH : AgentRole.EXECUTOR
  );
}

export function completeSkillStep(task: TaskRecord, stage: SkillStage) {
  if (!task.currentSkillExecution || task.currentSkillExecution.phase !== stage) {
    return;
  }
  setSkillStepStatus(task, stage, 'completed');
}

export function buildCurrentSkillExecution(
  task: TaskRecord,
  stage: SkillStage,
  now = new Date().toISOString()
): CurrentSkillExecutionRecord | undefined {
  const attachment = resolveCompiledSkillAttachment(task);
  if (!attachment) {
    return undefined;
  }
  const steps = attachment.metadata?.steps ?? [];
  const matchedStepIndex = resolveNextSkillStepIndex(task, attachment.id, stage, steps);
  if (matchedStepIndex < 0) {
    return undefined;
  }
  const matchedStep = steps[matchedStepIndex];
  if (!matchedStep) {
    return undefined;
  }
  return {
    skillId: attachment.sourceId ?? attachment.id,
    displayName: attachment.displayName,
    phase: stage,
    stepIndex: matchedStepIndex + 1,
    totalSteps: steps.length,
    title: matchedStep.title,
    instruction: matchedStep.instruction,
    toolNames: matchedStep.toolNames ?? [],
    updatedAt: now
  };
}

export function setSkillStepStatus(
  task: TaskRecord,
  stage: SkillStage,
  status: 'pending' | 'running' | 'completed' | 'blocked'
) {
  const attachment = resolveCompiledSkillAttachment(task);
  if (!attachment || !task.plan?.subTasks?.length) {
    return;
  }
  const assignedTo = stage === 'research' ? AgentRole.RESEARCH : AgentRole.EXECUTOR;
  const currentStepIndex =
    task.currentSkillExecution?.phase === stage ? task.currentSkillExecution.stepIndex : undefined;
  const target = task.plan.subTasks.find(subTask => {
    if (!subTask.id.startsWith(`skill_step:${attachment.id}:`) || subTask.assignedTo !== assignedTo) {
      return false;
    }
    if (typeof currentStepIndex === 'number') {
      return parseSkillSubTaskStepIndex(subTask.id) === currentStepIndex;
    }
    return subTask.status === 'pending' || subTask.status === 'running' || subTask.status === 'blocked';
  });
  if (target) {
    target.status = status;
  }
}

export function appendExecutionEvidence(
  task: TaskRecord,
  toolName: string | undefined,
  executionResult: { outputSummary: string; rawOutput?: unknown } | undefined
) {
  if (!toolName || !executionResult?.rawOutput || typeof executionResult.rawOutput !== 'object') {
    return;
  }

  const raw = executionResult.rawOutput as Record<string, unknown>;
  const resultItems = Array.isArray(raw.results) ? raw.results : Array.isArray(raw.items) ? raw.items : undefined;

  if (resultItems?.length) {
    const records = resultItems
      .map((item, index) => buildExecutionEvidenceRecord(task, toolName, executionResult, item, index))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (records.length) {
      task.externalSources = mergeEvidence(task.externalSources ?? [], records);
    }
    return;
  }

  const record = buildExecutionEvidenceRecord(task, toolName, executionResult, raw);
  if (record) {
    task.externalSources = mergeEvidence(task.externalSources ?? [], [record]);
  }
}

function resolveNextSkillStepIndex(
  task: TaskRecord,
  attachmentId: string,
  stage: SkillStage,
  steps: NonNullable<NonNullable<NonNullable<TaskRecord['capabilityAttachments']>[number]['metadata']>['steps']>
) {
  const preferredAssignedTo = stage === 'research' ? AgentRole.RESEARCH : AgentRole.EXECUTOR;
  const plannedSkillSubTasks = (task.plan?.subTasks ?? []).filter(
    subTask =>
      subTask.id.startsWith(`skill_step:${attachmentId}:`) &&
      subTask.assignedTo === preferredAssignedTo &&
      (subTask.status === 'pending' || subTask.status === 'running' || subTask.status === 'blocked')
  );
  if (plannedSkillSubTasks.length) {
    const runningSubTask = plannedSkillSubTasks.find(subTask => subTask.status === 'running');
    const targetSubTask = runningSubTask ?? plannedSkillSubTasks[0];
    const stepIndex = parseSkillSubTaskStepIndex(targetSubTask?.id);
    if (typeof stepIndex === 'number' && steps[stepIndex - 1]) {
      return stepIndex - 1;
    }
  }
  return steps.findIndex(step => {
    const toolNames = (step.toolNames ?? []).map(item => item.toLowerCase());
    if (stage === 'research') {
      return toolNames.length === 0 || toolNames.some(item => /(search|read|browse|doc|memory|web)/.test(item));
    }
    return (
      toolNames.length === 0 || toolNames.some(item => /(write|send|run|ship|open|browser|github|lark|http)/.test(item))
    );
  });
}

function parseSkillSubTaskStepIndex(subTaskId?: string) {
  if (!subTaskId) {
    return undefined;
  }
  const parts = subTaskId.split(':');
  const value = Number(parts.at(-1));
  return Number.isFinite(value) ? value : undefined;
}

function resolveCompiledSkillAttachment(task: TaskRecord) {
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

function buildExecutionEvidenceRecord(
  task: TaskRecord,
  toolName: string,
  executionResult: { outputSummary: string; rawOutput?: unknown },
  payload: unknown,
  index?: number
): EvidenceRecord | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const raw = payload as Record<string, unknown>;
  const url = typeof raw.url === 'string' ? raw.url : undefined;
  const matchedPlannedSource = (task.externalSources ?? []).find(source => source.sourceUrl === url);
  const sourceType =
    typeof raw.sourceType === 'string'
      ? raw.sourceType
      : toolName === 'collect_research_source' || toolName === 'http_request' || toolName === 'browse_page'
        ? 'web'
        : toolName === 'webSearchPrime'
          ? 'web_search_result'
          : undefined;

  if (!sourceType) {
    return undefined;
  }

  const summary =
    typeof raw.summary === 'string'
      ? raw.summary
      : typeof raw.snippet === 'string'
        ? raw.snippet
        : typeof raw.title === 'string'
          ? raw.title
          : typeof raw.snapshotSummary === 'string'
            ? raw.snapshotSummary
            : executionResult.outputSummary;

  return {
    id: `${task.id}:${toolName}:${index ?? 'single'}:${url ?? summary}`,
    taskId: task.id,
    sourceType,
    sourceUrl: url,
    trustClass:
      typeof raw.trustClass === 'string'
        ? (raw.trustClass as EvidenceRecord['trustClass'])
        : (matchedPlannedSource?.trustClass ?? 'official'),
    summary,
    detail: {
      toolName,
      transportSummary: executionResult.outputSummary,
      title: typeof raw.title === 'string' ? raw.title : undefined,
      query: typeof raw.query === 'string' ? raw.query : undefined,
      ...(matchedPlannedSource?.detail ?? {})
    },
    linkedRunId: task.runId,
    createdAt: task.updatedAt ?? task.createdAt,
    fetchedAt: typeof raw.fetchedAt === 'string' ? raw.fetchedAt : (task.updatedAt ?? task.createdAt),
    replay:
      toolName === 'browse_page'
        ? {
            sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : undefined,
            url,
            snapshotSummary: typeof raw.snapshotSummary === 'string' ? raw.snapshotSummary : undefined,
            screenshotRef: typeof raw.screenshotRef === 'string' ? raw.screenshotRef : undefined,
            artifactRef: typeof raw.artifactRef === 'string' ? raw.artifactRef : undefined,
            snapshotRef: typeof raw.snapshotRef === 'string' ? raw.snapshotRef : undefined,
            stepTrace: Array.isArray(raw.stepTrace) ? (raw.stepTrace as string[]) : undefined,
            steps: Array.isArray(raw.steps)
              ? (raw.steps as EvidenceRecord['replay'] extends { steps?: infer T } ? T : never)
              : undefined
          }
        : undefined
  } satisfies EvidenceRecord;
}
