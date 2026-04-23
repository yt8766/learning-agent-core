import type { ChatThoughtChainItem, ThoughtGraphNode } from '@agent/core';
import { TaskStatus } from '@agent/core';
import { getMinistryDisplayName } from './session-architecture-helpers';
import type { SessionTaskLike } from './session-task.types';

type TaskStatusValue = (typeof TaskStatus)[keyof typeof TaskStatus];

export function buildMinistryThinkContent(task: SessionTaskLike, latestSummary: string): string {
  const ministry = task.currentMinistry ?? '';
  const workerLine = task.currentWorker
    ? `当前由 ${getMinistryLabel(ministry)} 的 ${task.currentWorker} 具体推进。`
    : `当前由 ${getMinistryLabel(ministry)} 负责处理。`;
  const route = task.modelRoute?.find(item => item.ministry === ministry) ?? task.modelRoute?.at(-1);
  const routeLine = route ? `吏部为这一部选择了 ${route.selectedModel}，原因是 ${route.reason}。` : '';
  const planLine = task.plan?.steps?.length
    ? `这轮总计划共 ${task.plan.steps.length} 步，我当前承接的是 ${task.currentStep ?? '处理中'} 这一段。`
    : task.currentStep
      ? `我当前处理的阶段是 ${task.currentStep}。`
      : '';
  const latestLine = latestSummary ? `我这边的最新进展是：${latestSummary}` : '';
  const nextLine = buildMinistryNextActionHint(task, ministry);
  return [workerLine, routeLine, planLine, latestLine, nextLine].filter(Boolean).join('\n');
}

export function buildNextActionHint(task: SessionTaskLike): string {
  switch (task.currentStep) {
    case 'goal_intake':
      return '我接下来会先判断该走哪条流程模板，再决定需要调动哪些尚书。';
    case 'route':
      return '我接下来会完成吏部路由，把任务分派到最合适的尚书与模型。';
    case 'manager_plan':
      return '我接下来会把目标拆解成可执行步骤，并安排各部协同。';
    case 'dispatch':
      return '我接下来会正式下发子任务，让相关尚书开始行动。';
    case 'research':
      return '我接下来会整合检索结果，把关键上下文喂给执行阶段。';
    case 'execute':
      return '我接下来会继续执行方案，并在必要时把高风险动作转成阻塞式中断确认。';
    case 'review':
      return '我接下来会审查结果并整理成最终可交付的答复。';
    case 'finish':
      return '我接下来会结束当前流程并稳定输出最终结论。';
    default:
      return task.status === TaskStatus.COMPLETED
        ? '这一轮已经完成，我已准备好进入下一轮对话。'
        : task.status === TaskStatus.FAILED || task.status === TaskStatus.BLOCKED
          ? '当前流程已中断，我需要根据你的恢复或打回意见决定下一步。'
          : '我会继续沿着当前流程推进，并在有关键进展时及时同步给你。';
  }
}

export function buildMinistryNextActionHint(task: SessionTaskLike, ministry: string): string {
  switch (ministry) {
    case 'libu-governance':
    case 'libu-router':
      return '我接下来会继续平衡任务目标、成本和风险，决定该把任务交给哪一部和尚书。';
    case 'hubu-search':
      return '我接下来会继续检索外部资料、内部记忆和相关规范，把可用上下文整理给后续执行阶段。';
    case 'libu-delivery':
    case 'libu-docs':
      return task.currentStep === 'review'
        ? '我接下来会把已有结果整理成交付说明、接口规范或 README。'
        : '我接下来会先补齐规范、结构和文档要求，确保最终输出可交付。';
    case 'bingbu-ops':
      return '我接下来会继续执行终端、测试或发布链路；如果动作有风险，我会先触发阻塞式中断确认。';
    case 'xingbu-review':
      return '我接下来会审查当前产出，重点盯住质量风险、安全问题和是否需要打回重做。';
    case 'gongbu-code':
      return '我接下来会继续实现或重构代码，并把需要高风险落地的动作转成阻塞式中断确认。';
    default:
      return buildNextActionHint(task);
  }
}

export function getThinkTitle(task: SessionTaskLike): string {
  if (task.status === TaskStatus.WAITING_APPROVAL && task.activeInterrupt?.kind === 'user-input') {
    return '等待方案澄清';
  }
  if (task.status === TaskStatus.WAITING_APPROVAL) return '等待阻塞式中断确认';
  if (task.currentMinistry) return `${getMinistryLabel(task.currentMinistry)}正在汇报`;
  if (task.currentStep) return `当前阶段：${task.currentStep}`;
  return '首辅思考中';
}

export function getThoughtTitle(node: string): string {
  switch (node) {
    case 'decree_received':
      return '接收圣旨';
    case 'skill_resolved':
      return '解析流程模板';
    case 'skill_stage_started':
      return '流程阶段开始';
    case 'skill_stage_completed':
      return '流程阶段完成';
    case 'supervisor_planned':
    case 'manager_plan':
    case 'manager_replan':
      return '首辅规划';
    case 'libu_routed':
      return '吏部路由';
    case 'dispatch':
      return '分派尚书';
    case 'research':
      return '户部检索';
    case 'planning_readonly_guard':
      return '计划只读保护';
    case 'execute':
      return '工部/兵部执行';
    case 'review':
      return '刑部/礼部审查';
    case 'approval_gate':
      return '阻塞式中断确认';
    case 'run_resumed':
      return '恢复执行';
    case 'finish':
    case 'final_response_completed':
      return '汇总答复';
    default:
      return node;
  }
}

export function getThoughtStatus(
  node: string,
  taskStatus: TaskStatusValue,
  isLast: boolean
): ChatThoughtChainItem['status'] {
  if (node === 'finish' || node === 'final_response_completed' || taskStatus === TaskStatus.COMPLETED) return 'success';
  if (taskStatus === TaskStatus.FAILED || taskStatus === TaskStatus.BLOCKED) return isLast ? 'error' : 'success';
  if (taskStatus === TaskStatus.CANCELLED) return isLast ? 'abort' : 'success';
  if (node === 'approval_gate' && taskStatus === TaskStatus.WAITING_APPROVAL) return 'abort';
  return isLast ? 'loading' : 'success';
}

export function getMinistryLabel(ministry: string): string {
  return getMinistryDisplayName(ministry) ?? ministry;
}

export function mapTraceNodeToThoughtKind(node: string): ThoughtGraphNode['kind'] {
  if (node === 'entry_router' || node === 'mode_gate' || node === 'dispatch_planner' || node === 'context_filter') {
    return 'planning';
  }
  if (node === 'result_aggregator' || node === 'learning_recorder') return 'finalize';
  if (node === 'interrupt_controller') return 'approval';
  if (node.includes('approval')) return 'approval';
  if (node.includes('review') || node.includes('diagnosis')) return 'review';
  if (node.includes('recover') || node.includes('resume')) return 'recovery';
  if (node.includes('research') || node.includes('source')) return 'research';
  if (node.includes('final') || node.includes('deliver')) return 'finalize';
  if (node.includes('tool') || node.includes('execute') || node.includes('terminal') || node.includes('browser')) {
    return 'execution';
  }
  if (node.includes('fail') || node.includes('error')) return 'failure';
  return 'planning';
}

export function extractTraceErrorCode(detail: unknown): string | undefined {
  if (!detail || typeof detail !== 'object') return undefined;
  const value = (detail as Record<string, unknown>).errorCode;
  return typeof value === 'string' ? value : undefined;
}
