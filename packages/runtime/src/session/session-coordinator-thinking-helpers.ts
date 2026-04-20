import type {
  CheckpointRef,
  ChatCheckpointRecord,
  ChatThinkState,
  ChatThoughtChainItem,
  ThoughtGraphEdge,
  ThoughtGraphNode
} from '@agent/core';
import { TaskStatus } from '@agent/core';
import { normalizeExecutionMode } from './session-architecture-helpers';
import type { SessionTaskLike } from './session-task.types';
import {
  buildMinistryThinkContent,
  buildNextActionHint,
  buildMinistryNextActionHint,
  getThinkTitle,
  getThoughtTitle,
  getThoughtStatus,
  getMinistryLabel,
  mapTraceNodeToThoughtKind,
  extractTraceErrorCode
} from './session-thinking-resolvers';
export {
  buildMinistryThinkContent,
  buildNextActionHint,
  buildMinistryNextActionHint,
  getThinkTitle,
  getThoughtTitle,
  getThoughtStatus,
  getMinistryLabel,
  mapTraceNodeToThoughtKind,
  extractTraceErrorCode
} from './session-thinking-resolvers';

export function buildSessionThoughtChain(task: SessionTaskLike, messageId?: string): ChatThoughtChainItem[] {
  const thinkingDurationMs = getThinkingDurationMs(task);
  return task.trace.map((trace, index) => {
    const isLast = index === task.trace.length - 1;
    const detail = buildThoughtDetail(task, trace.node, trace.summary, isLast);
    const rawData = trace.data && Object.keys(trace.data).length > 0 ? JSON.stringify(trace.data, null, 2) : '';
    return {
      key: `${task.id}_${index}_${trace.node}`,
      messageId,
      thinkingDurationMs,
      title: getThoughtTitle(trace.node),
      description: detail.summary,
      content: [detail.content, rawData].filter(Boolean).join('\n\n'),
      footer: new Date(trace.at).toLocaleString(),
      status: getThoughtStatus(trace.node, task.status, isLast),
      collapsible: Boolean(detail.content || rawData),
      blink: isLast && task.status === TaskStatus.RUNNING
    };
  });
}

export function buildSessionThinkState(task: SessionTaskLike, messageId?: string): ChatThinkState | undefined {
  const latestTrace = task.trace.at(-1);
  if (!latestTrace) {
    return undefined;
  }

  return {
    messageId,
    thinkingDurationMs: getThinkingDurationMs(task),
    title: getThinkTitle(task),
    content: buildThinkContent(task, latestTrace.summary),
    loading: task.status === TaskStatus.RUNNING,
    blink: task.status === TaskStatus.RUNNING
  };
}

export function buildSessionThoughtGraph(
  task: SessionTaskLike,
  checkpoint: ChatCheckpointRecord
): { nodes: ThoughtGraphNode[]; edges: ThoughtGraphEdge[] } {
  const checkpointRef: CheckpointRef = {
    sessionId: checkpoint.sessionId,
    taskId: checkpoint.taskId,
    checkpointId: checkpoint.checkpointId,
    checkpointCursor: checkpoint.traceCursor,
    recoverability: checkpoint.recoverability ?? 'partial'
  };
  const nodes: ThoughtGraphNode[] = task.trace.map((trace, index) => ({
    id: `${checkpoint.checkpointId}:${index}`,
    kind: mapTraceNodeToThoughtKind(trace.node),
    label: trace.summary || trace.node,
    ministry: task.currentMinistry,
    status:
      index === task.trace.length - 1
        ? task.status === TaskStatus.FAILED || task.status === TaskStatus.BLOCKED
          ? 'failed'
          : task.status === TaskStatus.WAITING_APPROVAL
            ? 'blocked'
            : task.status === TaskStatus.COMPLETED
              ? 'completed'
              : 'running'
        : 'completed',
    at: trace.at,
    errorCode: extractTraceErrorCode(trace.data),
    checkpointRef
  }));
  const edges: ThoughtGraphEdge[] = nodes.slice(1).map((node, index) => ({
    from: nodes[index]!.id,
    to: node.id,
    reason: task.trace[index + 1]?.node ?? 'next'
  }));

  if (nodes.length === 0) {
    nodes.push({
      id: `${checkpoint.checkpointId}:planning`,
      kind: 'planning',
      label: task.goal,
      ministry: task.currentMinistry,
      status: 'pending',
      checkpointRef
    });
  }

  return { nodes, edges };
}

function buildThoughtDetail(
  task: SessionTaskLike,
  node: string,
  summary: string,
  isLast: boolean
): { summary: string; content?: string } {
  const ministry = task.currentMinistry;
  switch (node) {
    case 'decree_received':
      return {
        summary: '首辅已接旨，开始判断任务目标与整体协作方式。',
        content: `首辅视角：我先确认你的目标边界，再决定是直接回复，还是进入多部协作流程。\n原始记录：${summary}`
      };
    case 'skill_resolved':
      return {
        summary: '首辅已选定本轮流程模板，准备按既定治理路径推进。',
        content: `首辅视角：这一步决定了本轮默认会调动哪些尚书、允许哪些能力，以及哪些动作可能触发阻塞式中断确认。\n原始记录：${summary}`
      };
    case 'supervisor_planned':
    case 'manager_plan':
    case 'manager_replan':
      return {
        summary: '首辅已经完成拆解，并把任务转成可执行步骤。',
        content: `首辅视角：我在这里把大目标拆成更稳定的小步骤，这样后续每一部都知道该接什么任务。\n原始记录：${summary}`
      };
    case 'libu_routed':
      return {
        summary: '吏部已完成路由和选模，正在把任务发往合适的尚书。',
        content: `吏部视角：这一步会平衡任务难度、风险和成本，决定由谁处理，以及用哪个模型最合适。\n原始记录：${summary}`
      };
    case 'dispatch':
      return {
        summary: '首辅已经发出调令，相关尚书开始接令。',
        content: `首辅视角：我把每个子任务明确交给具体执行方，避免多部同时做重复工作。\n原始记录：${summary}`
      };
    case 'research':
      return {
        summary: '户部正在补齐资料和上下文，给后续执行提供依据。',
        content: `户部视角：我负责把外部资料、内部记忆和相关规范整理成可执行上下文，减少后续拍脑袋决策。\n原始记录：${summary}`
      };
    case 'planning_readonly_guard':
      return {
        summary: '计划只读保护已启用，当前主动跳过高成本或有副作用的研究路径。',
        content: `规划保护视角：当前仍处于方案收敛阶段，所以系统只保留仓库内与受控来源研究，open-web、浏览器、终端和写入能力会先被挡住。\n原始记录：${summary}`
      };
    case 'execute':
      return {
        summary: ministry === 'bingbu-ops' ? '兵部正在推进命令、测试或发布动作。' : '工部正在实现方案并推进具体执行。',
        content:
          ministry === 'bingbu-ops'
            ? `兵部视角：我负责跑终端、测试和受控发布；一旦发现高风险动作，会先触发阻塞式中断确认。\n原始记录：${summary}`
            : `工部视角：我负责把方案落成代码或执行结果；如果动作可能改写环境，我会先触发阻塞式中断确认。\n原始记录：${summary}`
      };
    case 'review':
      return {
        summary:
          ministry === 'libu-delivery' || ministry === 'libu-docs'
            ? '礼部正在整理交付说明与最终文档。'
            : '刑部正在审查质量、安全和是否需要打回。',
        content:
          ministry === 'libu-delivery' || ministry === 'libu-docs'
            ? `礼部视角：我会把当前结果整理成更适合交付的说明、规范或 README。\n原始记录：${summary}`
            : `刑部视角：我会重点关注质量风险、安全问题和是否需要返工，而不是只看“能不能跑”。\n原始记录：${summary}`
      };
    case 'approval_gate':
      return {
        summary: isLast ? '系统已暂停在阻塞式中断确认点，等待你拍板。' : '这一步曾进入阻塞式中断确认。',
        content: `中断视角：这里表示系统检测到了高风险动作，所以流程被主动挂起，直到你批准、打回，或附带反馈后再继续。\n原始记录：${summary}`
      };
    case 'run_resumed':
      return {
        summary: '中断确认已完成，流程正在从原位置恢复。',
        content: `恢复视角：系统会尽量沿用已有上下文继续推进，而不是从头再跑一遍。\n原始记录：${summary}`
      };
    case 'finish':
    case 'final_response_completed':
      return {
        summary: '首辅已经汇总完毕，准备向你呈递最终答复。',
        content: `首辅视角：前面的检索、执行、审查结果已经被汇总成最终可读的回复。\n原始记录：${summary}`
      };
    default:
      return { summary, content: summary };
  }
}

function getThinkingDurationMs(task: SessionTaskLike): number | undefined {
  const startedAt = task.trace[0]?.at ?? task.createdAt;
  const endedAt = task.trace.at(-1)?.at ?? task.updatedAt;
  if (!startedAt || !endedAt) {
    return undefined;
  }

  const durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return undefined;
  }

  return durationMs;
}

function buildThinkContent(task: SessionTaskLike, latestSummary: string): string {
  if (task.status === TaskStatus.WAITING_APPROVAL && task.activeInterrupt?.kind === 'user-input') {
    const title =
      task.planDraft?.questionSet?.title ??
      (task.activeInterrupt.payload &&
      typeof task.activeInterrupt.payload === 'object' &&
      typeof (task.activeInterrupt.payload as { questionSet?: { title?: string } }).questionSet?.title === 'string'
        ? (task.activeInterrupt.payload as { questionSet: { title: string } }).questionSet.title
        : '计划问题');
    const count = task.planDraft?.questions?.length ?? 0;
    return [
      `我已经把任务推进到方案收敛点：${title}。`,
      count > 0
        ? `当前共有 ${count} 个关键问题需要你拍板，我会在收到回答后继续收口计划。`
        : '当前存在高影响未知项，需要你先补充方向。',
      task.activeInterrupt.reason ?? '这些问题会改变交付路径、验证范围或风险边界。',
      '如果你不想继续计划，也可以直接跳过计划按推荐项执行，或者取消当前任务。'
    ].join('\n');
  }
  if (normalizeExecutionMode(task.executionMode) === 'plan') {
    const budget = task.planDraft?.microBudget;
    const budgetLine = budget
      ? `当前只读预算 ${budget.readOnlyToolsUsed}/${budget.readOnlyToolLimit}${budget.budgetTriggered ? '，预算已触顶。' : '。'}`
      : '';
    return [
      '当前仍处于计划只读阶段，我会优先收敛方案而不是直接动手执行。',
      '为避免过早消耗成本或触发副作用，我已经跳过 open-web、浏览器、终端和写入类路径。',
      budgetLine,
      latestSummary ? `最新进展：${latestSummary}` : '',
      '如果关键未知项仍然存在，我会直接发起计划问题，请你拍板后再继续。'
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (task.status === TaskStatus.WAITING_APPROVAL && task.pendingApproval) {
    const risk = task.pendingApproval.riskLevel ? `，风险等级为 ${task.pendingApproval.riskLevel}` : '';
    return [
      `我已经把任务推进到一个阻塞式中断确认点：${task.pendingApproval.intent}${risk}。`,
      task.pendingApproval.reason ?? '这个动作会影响外部环境，所以我先暂停执行，等待你的决定。',
      '你一旦批准，我会从当前上下文继续；如果你打回并附批注，我会按你的意见重规划。'
    ].join('\n');
  }
  if (task.currentMinistry) {
    return buildMinistryThinkContent(task, latestSummary);
  }
  const route = task.modelRoute?.at(-1);
  const routeLine = route ? `本轮选用模型 ${route.selectedModel}，因为 ${route.reason}。` : '';
  const planLine = task.plan?.steps?.length
    ? `整体计划共 ${task.plan.steps.length} 步，当前阶段是 ${task.currentStep ?? '处理中'}。`
    : task.currentStep
      ? `当前阶段是 ${task.currentStep}。`
      : '';
  const latestLine = latestSummary ? `最新进展：${latestSummary}` : '';
  return ['当前仍由首辅统一协调全局。', routeLine, planLine, latestLine, buildNextActionHint(task)]
    .filter(Boolean)
    .join('\n');
}
