import type { ApprovalCenterItem, DashboardPageKey, PlatformConsoleRecord, TaskRecord } from '@/types/admin';
import { getMinistryDisplayName, normalizeExecutionMode } from '@/lib/runtime-semantics';

// Dashboard hash filters normalize legacy aliases into canonical executionPlan.mode values.
export type ExecutionModeFilter = 'all' | 'plan' | 'execute' | 'imperial_direct';
export type InteractionKindFilter =
  | 'all'
  | 'approval'
  | 'plan-question'
  | 'supplemental-input'
  | 'revise-required'
  | 'micro-loop-exhausted'
  | 'mode-transition';
type ObservatoryFocusKind = 'checkpoint' | 'span' | 'evidence';

export interface DashboardHashState {
  page: DashboardPageKey;
  runtimeTaskId?: string;
  runtimeFocusKind?: ObservatoryFocusKind;
  runtimeFocusId?: string;
  runtimeCompareTaskId?: string;
  runtimeGraphNodeId?: string;
  runtimeStatusFilter: string;
  runtimeModelFilter: string;
  runtimePricingSourceFilter: string;
  runtimeExecutionModeFilter: ExecutionModeFilter;
  runtimeInteractionKindFilter: InteractionKindFilter;
  approvalsExecutionModeFilter: ExecutionModeFilter;
  approvalsInteractionKindFilter: InteractionKindFilter;
}

type HashLocationLike = Pick<Location, 'hash'>;

export const PAGE_KEYS: DashboardPageKey[] = [
  'runtime',
  'approvals',
  'learning',
  'workspace',
  'memory',
  'profiles',
  'evals',
  'archives',
  'skills',
  'evidence',
  'connectors',
  'skillSources',
  'companyAgents',
  'workflowLab'
];

const ADMIN_RUNTIME_PAGE_TITLES = {
  runtime: '运行中枢',
  approvals: '审批中枢',
  learning: '学习中枢',
  workspace: 'Agent Workspace',
  evals: '评测基线',
  archives: '归档中心',
  skills: '技能工坊',
  evidence: '证据中心',
  connectors: '连接器与策略',
  skillSources: '技能来源治理',
  companyAgents: '公司专员编排'
} as const;

export const PAGE_TITLES = {
  ...ADMIN_RUNTIME_PAGE_TITLES,
  memory: '记忆中枢',
  profiles: '画像中枢',
  workflowLab: '工作流实验室'
} satisfies Record<DashboardPageKey, string>;

function isExecutionModeFilter(value: string | null): value is ExecutionModeFilter {
  return value === 'all' || value === 'plan' || value === 'execute' || value === 'imperial_direct';
}

function isInteractionKindFilter(value: string | null): value is InteractionKindFilter {
  return (
    value === 'all' ||
    value === 'approval' ||
    value === 'plan-question' ||
    value === 'supplemental-input' ||
    value === 'revise-required' ||
    value === 'micro-loop-exhausted' ||
    value === 'mode-transition'
  );
}

function normalizeExecutionModeFilter(value: string | null): ExecutionModeFilter {
  if (value === 'all') {
    return 'all';
  }
  if (!value) {
    return 'all';
  }
  return isExecutionModeFilter(value) ? value : (normalizeExecutionMode(value) ?? 'all');
}

function isObservatoryFocusKind(value: string | null): value is ObservatoryFocusKind {
  return value === 'checkpoint' || value === 'span' || value === 'evidence';
}

export function readDashboardStateFromHash(locationLike: HashLocationLike = window.location): DashboardHashState {
  const [rawPage = '', rawQuery = ''] = locationLike.hash.replace(/^#\//, '').split('?');
  const page = PAGE_KEYS.includes(rawPage as DashboardPageKey) ? (rawPage as DashboardPageKey) : 'runtime';
  const params = new URLSearchParams(rawQuery);
  const runtimeTaskId = params.get('runtimeTaskId');
  const runtimeFocusKind = params.get('runtimeFocusKind');
  const runtimeFocusId = params.get('runtimeFocusId');
  const runtimeCompareTaskId = params.get('runtimeCompareTaskId');
  const runtimeGraphNodeId = params.get('runtimeGraphNodeId');
  const runtimeStatus = params.get('runtimeStatus');
  const runtimeModel = params.get('runtimeModel');
  const runtimePricingSource = params.get('runtimePricingSource');
  const runtimeExecutionMode = params.get('runtimeExecutionMode');
  const runtimeInteractionKind = params.get('runtimeInteractionKind');
  const approvalsExecutionMode = params.get('approvalsExecutionMode');
  const approvalsInteractionKind = params.get('approvalsInteractionKind');

  return {
    page,
    runtimeTaskId: runtimeTaskId ?? undefined,
    runtimeFocusKind: isObservatoryFocusKind(runtimeFocusKind) ? runtimeFocusKind : undefined,
    runtimeFocusId: runtimeFocusId ?? undefined,
    runtimeCompareTaskId: runtimeCompareTaskId ?? undefined,
    runtimeGraphNodeId: runtimeGraphNodeId ?? undefined,
    runtimeStatusFilter: runtimeStatus ?? '',
    runtimeModelFilter: runtimeModel ?? '',
    runtimePricingSourceFilter: runtimePricingSource ?? '',
    runtimeExecutionModeFilter: normalizeExecutionModeFilter(runtimeExecutionMode),
    runtimeInteractionKindFilter: isInteractionKindFilter(runtimeInteractionKind) ? runtimeInteractionKind : 'all',
    approvalsExecutionModeFilter: normalizeExecutionModeFilter(approvalsExecutionMode),
    approvalsInteractionKindFilter: isInteractionKindFilter(approvalsInteractionKind) ? approvalsInteractionKind : 'all'
  };
}

export function readPageFromHash(): DashboardPageKey {
  return readDashboardStateFromHash().page;
}

export function buildDashboardHash(state: DashboardHashState): string {
  const params = new URLSearchParams();
  if (state.page === 'runtime' && state.runtimeTaskId) {
    params.set('runtimeTaskId', state.runtimeTaskId);
  }
  if (state.page === 'runtime' && state.runtimeFocusKind && state.runtimeFocusId) {
    params.set('runtimeFocusKind', state.runtimeFocusKind);
    params.set('runtimeFocusId', state.runtimeFocusId);
  }
  if (state.page === 'runtime' && state.runtimeCompareTaskId) {
    params.set('runtimeCompareTaskId', state.runtimeCompareTaskId);
  }
  if (state.page === 'runtime' && state.runtimeGraphNodeId) {
    params.set('runtimeGraphNodeId', state.runtimeGraphNodeId);
  }
  if (state.runtimeStatusFilter) {
    params.set('runtimeStatus', state.runtimeStatusFilter);
  }
  if (state.runtimeModelFilter) {
    params.set('runtimeModel', state.runtimeModelFilter);
  }
  if (state.runtimePricingSourceFilter) {
    params.set('runtimePricingSource', state.runtimePricingSourceFilter);
  }
  if (state.runtimeExecutionModeFilter !== 'all') {
    params.set('runtimeExecutionMode', state.runtimeExecutionModeFilter);
  }
  if (state.runtimeInteractionKindFilter !== 'all') {
    params.set('runtimeInteractionKind', state.runtimeInteractionKindFilter);
  }
  if (state.approvalsExecutionModeFilter !== 'all') {
    params.set('approvalsExecutionMode', state.approvalsExecutionModeFilter);
  }
  if (state.approvalsInteractionKindFilter !== 'all') {
    params.set('approvalsInteractionKind', state.approvalsInteractionKindFilter);
  }

  const query = params.toString();
  return `#/${state.page}${query ? `?${query}` : ''}`;
}

export function buildDashboardShareUrl(
  state: DashboardHashState,
  locationLike: Pick<Location, 'origin' | 'pathname'> = window.location
) {
  return `${locationLike.origin}${locationLike.pathname}${buildDashboardHash(state)}`;
}

export function toApprovalItems(consoleData: PlatformConsoleRecord | null): ApprovalCenterItem[] {
  if (!consoleData) {
    return [];
  }

  // activeInterrupt is the persisted 司礼监 / InterruptController projection for approvals aggregation.
  return consoleData.approvals.flatMap(task =>
    task.approvals
      .filter(approval => approval.decision === 'pending')
      .map(approval => ({
        taskId: task.taskId,
        goal: task.goal,
        status: task.status,
        sessionId: task.sessionId,
        executionMode: normalizeExecutionMode(task.executionMode),
        currentMinistry: getMinistryDisplayName(task.currentMinistry) ?? task.currentMinistry,
        currentWorker: task.currentWorker,
        intent:
          task.activeInterrupt?.kind === 'user-input'
            ? (task.planDraft?.questionSet?.title ?? '计划问题')
            : (task.pendingApproval?.intent ?? task.activeInterrupt?.intent ?? approval.intent ?? 'interrupt'),
        interactionKind:
          task.activeInterrupt?.payload && typeof task.activeInterrupt.payload === 'object'
            ? ((
                task.activeInterrupt.payload as {
                  interactionKind?:
                    | 'approval'
                    | 'plan-question'
                    | 'supplemental-input'
                    | 'revise-required'
                    | 'micro-loop-exhausted'
                    | 'mode-transition';
                }
              ).interactionKind ?? (task.activeInterrupt.kind === 'user-input' ? 'plan-question' : 'approval'))
            : task.activeInterrupt?.kind === 'user-input'
              ? 'plan-question'
              : undefined,
        questionSetTitle:
          task.activeInterrupt?.payload &&
          typeof task.activeInterrupt.payload === 'object' &&
          typeof (task.activeInterrupt.payload as { questionSet?: { title?: string } }).questionSet?.title === 'string'
            ? (task.activeInterrupt.payload as { questionSet: { title: string } }).questionSet.title
            : undefined,
        reason: task.pendingApproval?.reason ?? task.activeInterrupt?.reason ?? approval.reason,
        reasonCode:
          task.pendingApproval?.reasonCode ??
          (task.activeInterrupt?.payload &&
          typeof task.activeInterrupt.payload === 'object' &&
          typeof (task.activeInterrupt.payload as { runtimeGovernanceReasonCode?: unknown })
            .runtimeGovernanceReasonCode === 'string'
            ? (task.activeInterrupt.payload as { runtimeGovernanceReasonCode: string }).runtimeGovernanceReasonCode
            : undefined) ??
          (task.activeInterrupt?.kind === 'tool-approval' ? 'requires_approval_tool_policy' : undefined),
        toolName: task.pendingApproval?.toolName ?? task.activeInterrupt?.toolName,
        riskLevel: task.pendingApproval?.riskLevel ?? task.activeInterrupt?.riskLevel,
        requestedBy:
          getMinistryDisplayName(task.pendingApproval?.requestedBy ?? task.activeInterrupt?.requestedBy) ??
          task.pendingApproval?.requestedBy ??
          task.activeInterrupt?.requestedBy,
        interruptSource: task.activeInterrupt?.source,
        interruptMode: task.activeInterrupt?.mode,
        resumeStrategy: task.activeInterrupt?.resumeStrategy,
        preview: task.pendingApproval?.preview ?? task.activeInterrupt?.preview,
        approvalScope:
          task.activeInterrupt?.payload &&
          typeof task.activeInterrupt.payload === 'object' &&
          ((task.activeInterrupt.payload as { approvalScope?: unknown }).approvalScope === 'once' ||
            (task.activeInterrupt.payload as { approvalScope?: unknown }).approvalScope === 'session' ||
            (task.activeInterrupt.payload as { approvalScope?: unknown }).approvalScope === 'always')
            ? (task.activeInterrupt.payload as { approvalScope: 'once' | 'session' | 'always' }).approvalScope
            : undefined,
        commandPreview:
          task.activeInterrupt?.payload &&
          typeof task.activeInterrupt.payload === 'object' &&
          typeof (task.activeInterrupt.payload as { commandPreview?: unknown }).commandPreview === 'string'
            ? (task.activeInterrupt.payload as { commandPreview: string }).commandPreview
            : undefined,
        riskReason:
          task.activeInterrupt?.payload &&
          typeof task.activeInterrupt.payload === 'object' &&
          typeof (task.activeInterrupt.payload as { riskReason?: unknown }).riskReason === 'string'
            ? (task.activeInterrupt.payload as { riskReason: string }).riskReason
            : undefined
      }))
  );
}

export function shouldPollTask(task?: TaskRecord) {
  return Boolean(task && ['queued', 'running', 'waiting_approval', 'waiting_interrupt'].includes(task.status));
}

export function downloadText(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
