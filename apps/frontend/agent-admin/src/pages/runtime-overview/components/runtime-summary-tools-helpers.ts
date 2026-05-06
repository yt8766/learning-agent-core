import type { RuntimeCenterRecord } from '@/types/admin';
import { getExecutionModeDisplayName, getMinistryDisplayName, normalizeExecutionMode } from '@/utils/runtime-semantics';

// activeInterrupt is the persisted 司礼监 / InterruptController projection for runtime-admin views.
export type InterruptInteractionKind =
  | 'approval'
  | 'plan-question'
  | 'supplemental-input'
  | 'revise-required'
  | 'micro-loop-exhausted'
  | 'mode-transition';

export interface RuntimeInterruptViewItem {
  taskId: string;
  goal: string;
  status: string;
  executionMode?: 'plan' | 'execute' | 'imperial_direct';
  interactionKind: InterruptInteractionKind;
  interruptLabel: string;
  reasonLabel?: string;
  isRuntimeGovernance?: boolean;
  isWatchdog?: boolean;
  currentMinistry?: string;
  currentWorker?: string;
  updatedAt: string;
}

export function getExecutionModeLabel(mode?: string) {
  return getExecutionModeDisplayName(mode) ?? '未标记';
}

export function getInteractionKindLabel(kind: InterruptInteractionKind) {
  switch (kind) {
    case 'plan-question':
      return '计划提问';
    case 'supplemental-input':
      return '补充输入';
    case 'revise-required':
      return '要求修订';
    case 'micro-loop-exhausted':
      return '微循环耗尽';
    case 'mode-transition':
      return '模式切换';
    case 'approval':
    default:
      return '操作确认';
  }
}

export function getRuntimeGovernanceReasonLabel(reasonCode?: string) {
  switch (reasonCode) {
    case 'watchdog_timeout':
      return '运行时超时阻塞';
    case 'watchdog_interaction_required':
      return '运行时等待补充输入';
    default:
      return reasonCode;
  }
}

export function toRuntimeInterruptItems(runtime: RuntimeCenterRecord): RuntimeInterruptViewItem[] {
  return (runtime.recentRuns ?? [])
    .filter(
      task => Boolean(task.activeInterrupt) || task.status === 'waiting_interrupt' || task.status === 'waiting_approval'
    )
    .map(task => {
      const payload = task.activeInterrupt?.payload as
        | {
            interactionKind?: InterruptInteractionKind;
            watchdog?: boolean;
            runtimeGovernanceReasonCode?: string;
          }
        | undefined;
      const interactionKind =
        payload?.interactionKind ?? (task.activeInterrupt?.kind === 'user-input' ? 'plan-question' : 'approval');
      const isRuntimeGovernance =
        task.activeInterrupt?.kind === 'runtime-governance' || task.currentNode === 'runtime_governance_gate';
      const reasonLabel = getRuntimeGovernanceReasonLabel(payload?.runtimeGovernanceReasonCode);

      return {
        taskId: task.id,
        goal: task.goal,
        status: task.status,
        executionMode: normalizeExecutionMode(task.executionMode),
        interactionKind,
        interruptLabel:
          task.activeInterrupt?.kind === 'user-input'
            ? (task.planDraft?.questionSet?.title ?? '计划问题')
            : isRuntimeGovernance
              ? (reasonLabel ?? '运行时治理中断')
              : (task.pendingApproval?.intent ?? task.activeInterrupt?.intent ?? '操作确认'),
        reasonLabel,
        isRuntimeGovernance,
        isWatchdog: payload?.watchdog === true,
        currentMinistry: getMinistryDisplayName(task.currentMinistry) ?? task.currentMinistry,
        currentWorker: task.currentWorker,
        updatedAt: task.updatedAt
      };
    })
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

export function filterRuntimeInterruptItems(
  items: RuntimeInterruptViewItem[],
  filters: {
    executionMode: 'all' | 'plan' | 'execute' | 'imperial_direct';
    interactionKind: 'all' | InterruptInteractionKind;
  }
) {
  return items.filter(item => {
    if (filters.executionMode !== 'all' && item.executionMode !== filters.executionMode) {
      return false;
    }
    if (filters.interactionKind !== 'all' && item.interactionKind !== filters.interactionKind) {
      return false;
    }
    return true;
  });
}
