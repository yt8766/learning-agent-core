import type { RunBundleRecord, WorkflowPresetDefinition } from '@agent/core';

type WorkflowMapStageStatus = 'pending' | 'running' | 'completed' | 'blocked' | 'failed';

export type WorkflowExecutionMapWorkflow = Pick<WorkflowPresetDefinition, 'id' | 'displayName'> &
  Partial<Pick<WorkflowPresetDefinition, 'requiredMinistries'>>;

export interface WorkflowExecutionMapStage {
  id: string;
  title: string;
  status: WorkflowMapStageStatus;
  summary: string;
  traces: RunBundleRecord['traces'];
  checkpoints: RunBundleRecord['checkpoints'];
  evidence: RunBundleRecord['evidence'];
  diagnostics: RunBundleRecord['diagnostics'];
  interrupts: RunBundleRecord['interrupts'];
}

const STAGE_TITLES: Record<string, string> = {
  plan: 'Plan',
  route: 'Route',
  research: 'Research',
  execution: 'Execution',
  review: 'Review',
  delivery: 'Delivery',
  interrupt: 'Interrupt',
  recover: 'Recover',
  learning: 'Learning'
};

const DEFAULT_STAGE_ORDER = [
  'plan',
  'route',
  'research',
  'execution',
  'review',
  'delivery',
  'interrupt',
  'recover',
  'learning'
];

function normalizeStageStatus(status?: string): WorkflowMapStageStatus {
  if (status === 'running' || status === 'completed' || status === 'blocked' || status === 'failed') {
    return status;
  }
  return 'pending';
}

function inferWorkflowStages(workflow?: WorkflowExecutionMapWorkflow) {
  const stages = new Set<string>(['plan', 'route', 'delivery']);
  const ministries = workflow?.requiredMinistries ?? [];

  if (ministries.includes('hubu-search')) {
    stages.add('research');
  }
  if (ministries.includes('gongbu-code') || ministries.includes('bingbu-ops')) {
    stages.add('execution');
  }
  if (ministries.includes('xingbu-review')) {
    stages.add('review');
  }
  if (ministries.includes('libu-delivery') || ministries.includes('libu-docs')) {
    stages.add('delivery');
  }

  return DEFAULT_STAGE_ORDER.filter(stage => stages.has(stage));
}

function summarizeStage(
  stage: string,
  params: {
    traces: RunBundleRecord['traces'];
    checkpoints: RunBundleRecord['checkpoints'];
    evidence: RunBundleRecord['evidence'];
    diagnostics: RunBundleRecord['diagnostics'];
    interrupts: RunBundleRecord['interrupts'];
  }
) {
  const parts = [
    params.traces.length ? `${params.traces.length} trace` : undefined,
    params.checkpoints.length ? `${params.checkpoints.length} checkpoint` : undefined,
    params.evidence.length ? `${params.evidence.length} evidence` : undefined,
    params.diagnostics.length ? `${params.diagnostics.length} diagnostic` : undefined,
    params.interrupts.length ? `${params.interrupts.length} interrupt` : undefined
  ].filter((value): value is string => Boolean(value));

  return parts.join(' / ') || `Stage ${STAGE_TITLES[stage] ?? stage} is waiting for runtime events.`;
}

export function buildWorkflowExecutionMap(params: {
  workflow?: WorkflowExecutionMapWorkflow;
  detail?: RunBundleRecord | null;
}): WorkflowExecutionMapStage[] {
  const { workflow, detail } = params;
  const timeline = detail?.timeline ?? [];
  const stageIds = timeline.length
    ? DEFAULT_STAGE_ORDER.filter(stage => timeline.some(item => item.stage === stage))
    : inferWorkflowStages(workflow);

  return stageIds.map(stage => {
    const timelineItem = timeline.find(item => item.stage === stage);
    const traces = (detail?.traces ?? []).filter(item => item.stage === stage);
    const checkpoints = (detail?.checkpoints ?? []).filter(item => item.stage === stage);
    const evidence = (detail?.evidence ?? []).filter(item => item.stage === stage);
    const diagnostics = (detail?.diagnostics ?? []).filter(item => item.linkedStage === stage);
    const interrupts = (detail?.interrupts ?? []).filter(item => item.stage === stage);

    return {
      id: stage,
      title: timelineItem?.title ?? STAGE_TITLES[stage] ?? stage,
      status: normalizeStageStatus(timelineItem?.status),
      summary:
        timelineItem?.summary ?? summarizeStage(stage, { traces, checkpoints, evidence, diagnostics, interrupts }),
      traces,
      checkpoints,
      evidence,
      diagnostics,
      interrupts
    };
  });
}
