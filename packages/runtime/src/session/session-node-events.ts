import type { ChatCheckpointRecord, ChatEventRecord } from '@agent/core';
import { getMinistryDisplayName } from './session-architecture-helpers';

import type { SessionCoordinatorStore } from './session-coordinator-store';

type NodePhase = 'start' | 'progress' | 'end';

const NODE_LABELS: Record<string, string> = {
  entry_router: '通政司接旨',
  mode_gate: '模式门裁剪',
  dispatch_planner: '群辅票拟',
  context_filter: '文书科压缩',
  result_aggregator: '礼部汇总',
  interrupt_controller: '司礼监审批',
  learning_recorder: '学政沉淀',
  approval_gate: '司礼监审批',
  manager_plan: '群辅票拟',
  research: '户部调研',
  execute: '工部执行',
  review: '刑部终审'
};

export function emitNodeStatusEvent(
  store: SessionCoordinatorStore,
  sessionId: string,
  params: {
    task: {
      id: string;
      currentMinistry?: string;
      currentWorker?: string;
      specialistLead?: {
        displayName: string;
      };
    };
    checkpoint: ChatCheckpointRecord;
    nodeId?: string;
    phase: NodePhase;
    detail?: string;
    progressPercent?: number;
  }
): ChatEventRecord | undefined {
  const nodeId = params.nodeId?.trim();
  if (!nodeId) {
    return undefined;
  }

  const payload = {
    taskId: params.task.id,
    nodeId,
    nodeLabel: resolveNodeLabel(nodeId, params.task.currentMinistry),
    department: params.task.currentMinistry,
    ministry: params.task.currentMinistry,
    phase: params.phase,
    detail: params.detail,
    progressPercent: params.progressPercent,
    worker: params.task.currentWorker,
    specialist: params.task.specialistLead?.displayName
  };
  const eventType: ChatEventRecord['type'] = params.phase === 'progress' ? 'node_progress' : 'node_status';
  const event = store.addEvent(sessionId, eventType, payload);

  params.checkpoint.streamStatus = {
    nodeId,
    nodeLabel: payload.nodeLabel,
    detail: params.detail,
    progressPercent: params.progressPercent,
    updatedAt: event.at
  };
  params.checkpoint.updatedAt = event.at;
  return event;
}

function resolveNodeLabel(nodeId: string, ministry?: string) {
  if (NODE_LABELS[nodeId]) {
    return NODE_LABELS[nodeId];
  }
  if (ministry) {
    return `${getMinistryDisplayName(ministry) ?? ministry}处理中`;
  }
  return nodeId.replace(/_/g, ' ');
}
