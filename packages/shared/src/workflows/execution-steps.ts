import type {
  ChatRouteRecord,
  ExecutionStepOwner,
  ExecutionStepRecord,
  ExecutionStepRoute,
  ExecutionStepStage,
  ExecutionStepStatus,
  TaskRecord
} from '../types';

const STEP_LABELS: Record<ExecutionStepStage, string> = {
  'request-received': '接收请求',
  'route-selection': '路由判断',
  'task-planning': '任务规划',
  research: '研究取证',
  execution: '执行实施',
  review: '审查校验',
  delivery: '交付输出',
  'approval-interrupt': '审批中断',
  recovery: '恢复继续'
};

const STEP_OWNERS: Record<ExecutionStepStage, ExecutionStepOwner> = {
  'request-received': 'session',
  'route-selection': 'libu',
  'task-planning': 'libu',
  research: 'hubu',
  execution: 'gongbu',
  review: 'xingbu',
  delivery: 'libu-docs',
  'approval-interrupt': 'system',
  recovery: 'system'
};

const ROUTE_STAGE_TEMPLATES: Record<ExecutionStepRoute, ExecutionStepStage[]> = {
  'direct-reply': ['request-received', 'route-selection', 'research', 'delivery'],
  'research-first': ['request-received', 'route-selection', 'task-planning', 'research', 'delivery'],
  'workflow-execute': [
    'request-received',
    'route-selection',
    'task-planning',
    'research',
    'execution',
    'review',
    'delivery'
  ],
  'approval-recovery': [
    'request-received',
    'route-selection',
    'approval-interrupt',
    'recovery',
    'execution',
    'review',
    'delivery'
  ]
};

function deriveExecutionStepRoute(route?: ChatRouteRecord): ExecutionStepRoute {
  switch (route?.intent) {
    case 'research-first':
      return 'research-first';
    case 'approval-recovery':
      return 'approval-recovery';
    case 'workflow-execute':
    case 'plan-only':
      return 'workflow-execute';
    case 'direct-reply':
      return 'direct-reply';
    default:
      return route?.flow === 'approval'
        ? 'approval-recovery'
        : route?.flow === 'direct-reply'
          ? 'direct-reply'
          : 'workflow-execute';
  }
}

function buildStepId(route: ExecutionStepRoute, stage: ExecutionStepStage) {
  return `execution_step_${route}_${stage}`;
}

function normalizeTaskStepCollection(task: TaskRecord) {
  task.executionSteps ??= [];
  return task.executionSteps;
}

function updateChatRouteSummary(task: TaskRecord, route: ExecutionStepRoute) {
  if (!task.chatRoute) {
    return;
  }
  task.chatRoute.stepsSummary = buildExecutionStepSummary(route, task.executionSteps ?? []);
}

export function buildExecutionStepSummary(route: ExecutionStepRoute, recordedSteps: ExecutionStepRecord[]) {
  const recordedMap = new Map(recordedSteps.map(step => [`${step.route}:${step.stage}`, step] as const));
  const templated = ROUTE_STAGE_TEMPLATES[route].map(stage => {
    const existing = recordedMap.get(`${route}:${stage}`);
    if (existing) {
      return existing;
    }
    return {
      id: buildStepId(route, stage),
      route,
      stage,
      label: STEP_LABELS[stage],
      owner: STEP_OWNERS[stage],
      status: 'pending' as const,
      startedAt: ''
    };
  });
  const extras = recordedSteps.filter(
    step => step.route === route && !ROUTE_STAGE_TEMPLATES[route].includes(step.stage)
  );
  return [...templated, ...extras];
}

function upsertStep(task: TaskRecord, route: ExecutionStepRoute, stage: ExecutionStepStage) {
  const steps = normalizeTaskStepCollection(task);
  const existing = steps.find(step => step.route === route && step.stage === stage);
  if (existing) {
    return existing;
  }
  const next: ExecutionStepRecord = {
    id: buildStepId(route, stage),
    route,
    stage,
    label: STEP_LABELS[stage],
    owner: STEP_OWNERS[stage],
    status: 'pending',
    startedAt: ''
  };
  steps.push(next);
  return next;
}

export function transitionTaskExecutionStep(
  task: TaskRecord,
  params: {
    stage: ExecutionStepStage;
    status: ExecutionStepStatus;
    detail?: string;
    reason?: string;
    owner?: ExecutionStepOwner;
    route?: ExecutionStepRoute;
    at?: string;
  }
) {
  const route = params.route ?? deriveExecutionStepRoute(task.chatRoute);
  const at = params.at ?? new Date().toISOString();
  const step = upsertStep(task, route, params.stage);

  step.route = route;
  step.label = STEP_LABELS[params.stage];
  step.owner = params.owner ?? STEP_OWNERS[params.stage];
  step.status = params.status;
  step.detail = params.detail;
  step.reason = params.reason;

  if (!step.startedAt || params.status === 'running') {
    step.startedAt = at;
  }
  if (params.status === 'completed') {
    step.completedAt = at;
    if (!step.startedAt) {
      step.startedAt = at;
    }
  } else if (params.status === 'running') {
    step.completedAt = undefined;
  }

  task.currentExecutionStep = step;
  updateChatRouteSummary(task, route);
  return step;
}

export function markExecutionStepStarted(
  task: TaskRecord,
  stage: ExecutionStepStage,
  detail?: string,
  owner?: ExecutionStepOwner
) {
  return transitionTaskExecutionStep(task, {
    stage,
    status: 'running',
    detail,
    owner
  });
}

export function markExecutionStepCompleted(
  task: TaskRecord,
  stage: ExecutionStepStage,
  detail?: string,
  owner?: ExecutionStepOwner
) {
  return transitionTaskExecutionStep(task, {
    stage,
    status: 'completed',
    detail,
    owner
  });
}

export function markExecutionStepBlocked(
  task: TaskRecord,
  stage: ExecutionStepStage,
  reason?: string,
  detail?: string,
  owner?: ExecutionStepOwner
) {
  return transitionTaskExecutionStep(task, {
    stage,
    status: 'blocked',
    reason,
    detail,
    owner
  });
}

export function markExecutionStepResumed(
  task: TaskRecord,
  stage: ExecutionStepStage,
  detail?: string,
  owner?: ExecutionStepOwner
) {
  return transitionTaskExecutionStep(task, {
    stage,
    status: 'running',
    detail,
    owner
  });
}

export function initializeTaskExecutionSteps(task: TaskRecord) {
  const route = deriveExecutionStepRoute(task.chatRoute);
  updateChatRouteSummary(task, route);
}
