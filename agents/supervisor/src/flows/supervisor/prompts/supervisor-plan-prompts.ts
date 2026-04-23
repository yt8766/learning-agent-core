import { buildStructuredPrompt } from '../../../utils/prompts/prompt-template';
import { buildFreshnessAnswerInstruction, buildTemporalContextBlock } from '../../../utils/prompts/temporal-context';
import { isConversationRecallGoal } from '../../../workflows/workflow-route-registry';

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
    'subTasks 固定输出 3 个子任务，分别覆盖研究、执行、评审。',
    '如果某个子任务明显依赖专项能力，为该子任务补 requiredCapabilities，例如 technical architecture -> specialist.technical-architecture，risk/compliance -> specialist.risk-compliance。'
  ],
  output: ['只输出符合 Schema 的 JSON。'],
  json: true
});

function buildSpecialistPlanningHintBlock(input?: {
  specialistLead?: {
    displayName: string;
    domain: string;
    requiredCapabilities?: string[];
    agentId?: string;
    candidateAgentIds?: string[];
  };
  supportingSpecialists?: Array<{
    displayName: string;
    domain: string;
    requiredCapabilities?: string[];
    agentId?: string;
    candidateAgentIds?: string[];
  }>;
  routeConfidence?: number;
}) {
  if (!input?.specialistLead) {
    return '';
  }

  const lead = input.specialistLead;
  const support = (input.supportingSpecialists ?? [])
    .map(
      item =>
        `${item.displayName}(${item.domain}${item.requiredCapabilities?.length ? `; capabilities=${item.requiredCapabilities.join(',')}` : ''})`
    )
    .join('；');

  return [
    '以下是当前已收敛的 specialist route 提示，请优先据此规划：',
    `主导专家：${lead.displayName}(${lead.domain})`,
    lead.requiredCapabilities?.length ? `主导能力需求：${lead.requiredCapabilities.join(', ')}` : '',
    lead.agentId ? `首选官方 Agent：${lead.agentId}` : '',
    lead.candidateAgentIds?.length ? `候选官方 Agent：${lead.candidateAgentIds.join(', ')}` : '',
    lead.requiredCapabilities?.length && !lead.candidateAgentIds?.length
      ? '当前尚未命中官方 Agent，请把 capability gap 确认与替代路径纳入规划。'
      : '',
    lead.candidateAgentIds && lead.candidateAgentIds.length >= 2
      ? `当前存在 ${lead.candidateAgentIds.length} 个候选官方 Agent，请把并行研究与收敛选择纳入规划。`
      : '',
    support ? `支撑专家：${support}` : '',
    typeof input.routeConfidence === 'number' ? `路由置信度：${input.routeConfidence.toFixed(2)}` : '',
    '规划时要让研究/执行/评审子任务尽量继承这些 specialist / capability 线索。'
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildSupervisorPlanUserPrompt(
  goal: string,
  input?: {
    specialistLead?: {
      displayName: string;
      domain: string;
      requiredCapabilities?: string[];
      agentId?: string;
      candidateAgentIds?: string[];
    };
    supportingSpecialists?: Array<{
      displayName: string;
      domain: string;
      requiredCapabilities?: string[];
      agentId?: string;
      candidateAgentIds?: string[];
    }>;
    routeConfidence?: number;
  }
) {
  return [buildTemporalContextBlock(), buildSpecialistPlanningHintBlock(input), `目标：${goal}`]
    .filter(Boolean)
    .join('\n');
}

export function buildSupervisorDirectReplyUserPrompt(goal: string) {
  const recallInstruction = isConversationRecallGoal(goal)
    ? [
        '当前问题属于会话回顾类追问。',
        '请基于最近几轮真实对话做 1 段到 3 段简短回顾，优先总结主题、结论和用户仍可继续追问的点。',
        '不要复读上一轮完整答案，不要继续展开成新的长篇说明。'
      ].join('\n')
    : '';

  return [buildTemporalContextBlock(), buildFreshnessAnswerInstruction(goal), recallInstruction, `目标：${goal}`]
    .filter(Boolean)
    .join('\n');
}

export const SUPERVISOR_DIRECT_REPLY_PROMPT = buildStructuredPrompt({
  role: '内阁首辅',
  objective: '直接回答用户问题，不暴露内部规划过程。',
  rules: [
    '始终使用中文。',
    '优先像成熟聊天助手一样自然回答，先直接回应用户当前问题，再补必要说明。',
    '如果用户是在追问上一轮内容，要默认结合当前会话上下文连续回答，不要把问题当成脱离上下文的新任务。',
    '如果用户是在回顾刚刚的对话，只做简短总结或回顾，不要继续续写上一轮完整回答。',
    '像“你是谁”“你能做什么”这类问题直接给最终答复。',
    '如果问题涉及“最近 / 最新 / 今天”等时效性信息，必须以当前绝对日期为准，不要沿用旧年份。',
    '不要提及研究节点、执行节点、评审节点或内部流程。',
    '不要把回答写成任务汇报、流程汇报或公文式总结。',
    '默认使用短段落，只有在内容天然是列表时才使用列表。'
  ],
  output: ['只输出面向用户的最终答案。']
});

export function buildSupervisorDirectReplySystemPrompt(modelId?: string): string {
  const modelLine = modelId
    ? `当前运行模型为 ${modelId}；如果用户询问"你用的是什么模型"或类似问题，如实告知。`
    : undefined;
  return buildStructuredPrompt({
    role: '内阁首辅',
    objective: '直接回答用户问题，不暴露内部规划过程。',
    rules: [
      '始终使用中文。',
      '优先像成熟聊天助手一样自然回答，先直接回应用户当前问题，再补必要说明。',
      '如果用户是在追问上一轮内容，要默认结合当前会话上下文连续回答，不要把问题当成脱离上下文的新任务。',
      '如果用户是在回顾刚刚的对话，只做简短总结或回顾，不要继续续写上一轮完整回答。',
      '像"你是谁""你能做什么"这类问题直接给最终答复。',
      '如果问题涉及"最近 / 最新 / 今天"等时效性信息，必须以当前绝对日期为准，不要沿用旧年份。',
      '不要提及研究节点、执行节点、评审节点或内部流程。',
      '不要把回答写成任务汇报、流程汇报或公文式总结。',
      '默认使用短段落，只有在内容天然是列表时才使用列表。',
      ...(modelLine ? [modelLine] : [])
    ],
    output: ['只输出面向用户的最终答案。']
  });
}
