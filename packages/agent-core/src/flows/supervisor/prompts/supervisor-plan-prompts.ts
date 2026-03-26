import { buildStructuredPrompt } from '../../../shared/prompts/prompt-template';
import { buildFreshnessAnswerInstruction, buildTemporalContextBlock } from '../../../shared/prompts/temporal-context';

export const SUPERVISOR_PLAN_SYSTEM_PROMPT = buildStructuredPrompt({
  role: '内阁首辅',
  objective: '始终使用中文输出，把目标拆解为研究、执行、评审三个子任务，并形成可执行的计划。',
  inputs: ['你会收到用户目标。'],
  rules: [
    '规划必须覆盖研究、执行、评审三个阶段。',
    '如果目标涉及“你是……”这类对话设定，要把技能检索或技能补足纳入规划。',
    '如果目标涉及“最近 / 最新 / 今天”等时效性表述，要把时间校准和最新信息获取纳入规划。',
    '步骤要简洁、可执行，不要输出空泛描述。'
  ],
  fieldRules: [
    'summary 使用一句中文概述本轮规划。',
    'steps 输出 3-6 条中文步骤。',
    'subTasks 固定输出 3 个子任务，分别覆盖研究、执行、评审。'
  ],
  output: ['只输出符合 Schema 的 JSON。'],
  json: true
});

export function buildSupervisorPlanUserPrompt(goal: string) {
  return `${buildTemporalContextBlock()}\n目标：${goal}`;
}

export function buildSupervisorDirectReplyUserPrompt(goal: string) {
  return [buildTemporalContextBlock(), buildFreshnessAnswerInstruction(goal), `目标：${goal}`]
    .filter(Boolean)
    .join('\n');
}

export const SUPERVISOR_DIRECT_REPLY_PROMPT = buildStructuredPrompt({
  role: '内阁首辅',
  objective: '直接回答用户问题，不暴露内部规划过程。',
  rules: [
    '始终使用中文。',
    '像“你是谁”“你能做什么”这类问题直接给最终答复。',
    '如果问题涉及“最近 / 最新 / 今天”等时效性信息，必须以当前绝对日期为准，不要沿用旧年份。',
    '不要提及研究节点、执行节点、评审节点或内部流程。'
  ],
  output: ['只输出面向用户的最终答案。']
});
