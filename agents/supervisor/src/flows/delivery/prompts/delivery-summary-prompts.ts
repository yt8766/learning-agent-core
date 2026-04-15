import { buildStructuredPrompt } from '@agent/adapters';
import { stripOperationalBoilerplate } from '../../../utils/prompts/runtime-output-sanitizer';
import { buildFreshnessAnswerInstruction, buildTemporalContextBlock } from '../../../utils/prompts/temporal-context';

export const DELIVERY_SUMMARY_SYSTEM_PROMPT = buildStructuredPrompt({
  role: '礼部交付官',
  objective: '把执行结果和评审结论整合成简洁、自然、可直接展示给用户的最终回复。',
  inputs: ['你会收到目标、执行摘要、评审结论、评审说明，以及可选的时效性来源透明度与引用来源。'],
  rules: [
    '始终使用中文。',
    '输出最终答复，不要解释内部链路。',
    '先给用户最重要的结论，再补关键依据和下一步。',
    '如果用户问题涉及时效性信息，答案里优先使用绝对日期，不要模糊说“最近”或沿用旧年份。',
    '如果提示里给了“可引用来源”，只引用本轮真实提供的来源，不要编造、替换或沿用与当前问题无关的固定站点。',
    '如果问题是产品/业务判断，优先从目标、约束、风险和验证顺序解释，不要只做功能点评。',
    '如果问题是 agent 故障诊断，优先回答根因、恢复步骤、是否建议立即重试。'
  ],
  output: ['只输出最终用户答复。', '不回放内部思维链，不复读 trace。']
});

function isProductExpertGoal(goal: string) {
  const normalized = goal.trim().toLowerCase();
  return /(产品|规划|商业化|获客|留存|转化|vip|版本|路线图|增长|运营|定价|gmv|支付|渠道|投放|复盘|产品经理|product|roadmap|retention|conversion|growth)/i.test(
    normalized
  );
}

function isDiagnosisTaskGoal(goal: string) {
  const normalized = goal.trim().toLowerCase();
  return (
    normalized.includes('diagnosis_for:') ||
    normalized.includes('请诊断任务') ||
    normalized.includes('agent 错误') ||
    normalized.includes('恢复方案') ||
    normalized.includes('diagnose task')
  );
}

function buildDiagnosisAnswerInstruction(goal: string) {
  if (!isDiagnosisTaskGoal(goal)) {
    return '';
  }

  return [
    '本题属于 agent 故障诊断任务。',
    '最终答复必须优先覆盖 3 个部分：根因判断、恢复步骤、是否建议立即重试。',
    '如果根因尚不确定，要明确指出最可能原因和仍需核实的点。',
    '恢复步骤尽量给出 2-4 条可执行动作，不要泛泛而谈。',
    '如果不建议立即重试，要明确说明阻塞点，例如审批、连接器、状态机或上游 provider。'
  ].join('\n');
}

function buildProductExpertAnswerInstruction(goal: string) {
  if (!isProductExpertGoal(goal)) {
    return '';
  }

  return [
    '本题按产品/业务专家视角回答。',
    '最终答复优先覆盖 3 个部分：结论、为什么这么说、后续怎么做。',
    '“为什么这么说”必须解释判断依据，优先围绕业务目标、转化链路、风险、资源约束和验证顺序。',
    '“后续怎么做”必须给出 3-5 条可执行动作，优先说明先后顺序。',
    '如果现有材料不足，不要为了凑结构硬写泛化套话。'
  ].join('\n');
}

export function buildDeliverySummaryUserPrompt(
  goal: string,
  executionSummary: string,
  reviewDecision: string,
  notes: string[],
  freshnessSourceSummary?: string,
  citationSourceSummary?: string
) {
  return [
    buildTemporalContextBlock(),
    buildFreshnessAnswerInstruction(goal),
    buildDiagnosisAnswerInstruction(goal),
    buildProductExpertAnswerInstruction(goal),
    '请先识别用户最关心的结论，再组织最终答复。',
    freshnessSourceSummary ? `来源透明度：${freshnessSourceSummary}` : '',
    citationSourceSummary
      ? [
          '引用要求：只能引用下列本轮真实来源；如果这些来源不足，就不要硬写“引用来源”段落。',
          `可引用来源：\n${citationSourceSummary}`
        ].join('\n')
      : '',
    `目标：${goal}`,
    `执行摘要：${executionSummary}`,
    `评审结论：${reviewDecision}`,
    `评审说明：${notes.join('；')}`
  ]
    .filter(Boolean)
    .join('\n');
}

export function sanitizeFinalUserReply(content: string): string {
  const normalized = stripOperationalBoilerplate(content);

  return normalized || content.trim();
}

export function shapeFinalUserReply(content: string, citationSourceSummary?: string, goal?: string): string {
  const sanitized = sanitizeFinalUserReply(content);
  const hasCitationSection = /(^|\n)\s*引用来源[:：]?/m.test(sanitized);
  const hasStructuredSections =
    /(^|\n)\s*结论[:：]?/m.test(sanitized) ||
    /(^|\n)\s*为什么这么说[:：]?/m.test(sanitized) ||
    /(^|\n)\s*后续怎么做[:：]?/m.test(sanitized) ||
    /(^|\n)\s*关键依据[:：]?/m.test(sanitized);

  if (!citationSourceSummary?.trim() || hasCitationSection) {
    return sanitized;
  }

  const references = citationSourceSummary
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
    .join('\n');

  if (!references) {
    return sanitized;
  }

  if (hasStructuredSections || (goal && isProductExpertGoal(goal))) {
    return [sanitized, '', '引用来源', references].filter(Boolean).join('\n');
  }

  return [sanitized, '', '引用来源', references].join('\n');
}
