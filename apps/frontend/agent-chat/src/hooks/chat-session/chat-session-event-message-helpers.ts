import {
  buildExecutionStepEventCopy,
  buildNodeLifecycleEventCopy,
  buildTaskTrajectoryEventCopy,
  buildTrajectoryStepEventCopy
} from '@/utils/chat-trajectory-projections';

function getIntentLabel(intent: string) {
  switch (intent) {
    case 'write_file':
      return '文件写入';
    case 'call_external_api':
      return '外部请求';
    case 'read_file':
      return '文件读取';
    default:
      return intent;
  }
}

export function buildApprovalRequiredCopy(payload: Record<string, unknown>) {
  const intent = typeof payload.intent === 'string' ? payload.intent : 'unknown';
  const toolName = typeof payload.toolName === 'string' ? payload.toolName : '';
  const requestedBy = typeof payload.requestedBy === 'string' ? payload.requestedBy : '';
  const reason = typeof payload.reason === 'string' ? payload.reason : '';
  const interruptMode =
    payload.interruptMode === 'blocking' || payload.interruptMode === 'non-blocking'
      ? payload.interruptMode
      : undefined;
  const interruptSource =
    payload.interruptSource === 'graph' || payload.interruptSource === 'tool' ? payload.interruptSource : undefined;
  const intentLabel = getIntentLabel(intent);
  const toolSuffix = toolName ? `，工具为 ${toolName}` : '';
  const actorSuffix = requestedBy ? `，由 ${requestedBy} 发起` : '';
  const sourceSuffix =
    interruptSource === 'graph' ? '，由图内中断触发' : interruptSource === 'tool' ? '，由工具内中断触发' : '';
  const prefix = interruptMode === 'non-blocking' ? '中断建议' : '阻塞式中断确认';
  const commandPreview = typeof payload.commandPreview === 'string' ? payload.commandPreview : '';
  const riskReason = typeof payload.riskReason === 'string' ? payload.riskReason : '';
  const approvalScope = typeof payload.approvalScope === 'string' ? payload.approvalScope : '';
  const commandSuffix = commandPreview ? ` 命令预览：${commandPreview}。` : '';
  const riskSuffix = riskReason ? ` 风险说明：${riskReason}` : '';
  const scopeSuffix = approvalScope ? ` 审批范围：${approvalScope === 'once' ? '仅本次' : approvalScope}` : '';

  if (reason) {
    return `${prefix}：准备执行${intentLabel}${toolSuffix}${actorSuffix}${sourceSuffix}。${reason}${commandSuffix}${riskSuffix}${scopeSuffix}`;
  }

  return `${prefix}：准备执行${intentLabel}${toolSuffix}${actorSuffix}${sourceSuffix}。该动作具有风险，需要你明确拍板后才能继续。${commandSuffix}${riskSuffix}${scopeSuffix}`;
}

export function buildPlanQuestionCopy(payload: Record<string, unknown>) {
  const summary =
    payload.questionSet &&
    typeof payload.questionSet === 'object' &&
    typeof (payload.questionSet as { summary?: unknown }).summary === 'string'
      ? (payload.questionSet as { summary: string }).summary
      : typeof payload.reason === 'string'
        ? payload.reason
        : '存在高影响未知项，需要你先帮助我收敛方案。';
  const count = Array.isArray(payload.questions) ? payload.questions.length : 0;
  return count > 0 ? `等待方案澄清：当前有 ${count} 个计划问题需要你拍板。${summary}` : `等待方案澄清：${summary}`;
}

export function buildNodeStatusCopy(payload: Record<string, unknown>) {
  const lifecycleCopy = buildNodeLifecycleEventCopy(payload);
  if (lifecycleCopy) {
    return lifecycleCopy;
  }

  const nodeLabel = typeof payload.nodeLabel === 'string' ? payload.nodeLabel : '当前节点';
  const detail = typeof payload.detail === 'string' ? payload.detail : '';
  const ministry = typeof payload.ministry === 'string' ? payload.ministry : '';
  const phase = payload.phase === 'end' ? 'end' : payload.phase === 'progress' ? 'progress' : 'start';
  const progressPercent = typeof payload.progressPercent === 'number' ? payload.progressPercent : undefined;
  const ministryPrefix = ministry ? `${ministry} · ` : '';
  if (phase === 'start') {
    return `${ministryPrefix}${nodeLabel} 已开始${detail ? `：${detail}` : '。'}`;
  }
  if (phase === 'progress') {
    return `${ministryPrefix}${nodeLabel} 进行中${detail ? `：${detail}` : ''}${
      typeof progressPercent === 'number' ? `（${progressPercent}%）` : ''
    }`;
  }
  return `${ministryPrefix}${nodeLabel} 已完成${detail ? `：${detail}` : '。'}`;
}

const TOOL_STREAM_EVENT_LABELS: Record<string, string> = {
  tool_selected: '工具已选择',
  tool_stream_detected: '工具输出已检测',
  tool_stream_dispatched: '工具输出已分发',
  tool_stream_completed: '工具输出已完成'
};

export function buildToolStreamEventCopy(eventType: string, payload: Record<string, unknown>) {
  const label = TOOL_STREAM_EVENT_LABELS[eventType] ?? '工具执行更新';
  const segments = [getString(payload.toolName), getString(payload.nodeId), getString(payload.runId)].filter(Boolean);
  const detail =
    getString(payload.detail) ??
    getString(payload.summary) ??
    getString(payload.outputPreview) ??
    getString(payload.status);

  return `${label}：${segments.length ? segments.join(' · ') : '当前工具'}${detail ? `。${detail}` : '。'}`;
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export { buildExecutionStepEventCopy, buildTaskTrajectoryEventCopy, buildTrajectoryStepEventCopy };
