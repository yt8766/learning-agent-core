import { buildStructuredPrompt } from '../../../shared/prompts/prompt-template';
import { buildFreshnessAnswerInstruction, buildTemporalContextBlock } from '../../../shared/prompts/temporal-context';

export const DELIVERY_SUMMARY_SYSTEM_PROMPT = buildStructuredPrompt({
  role: '礼部交付官',
  objective: '把执行结果和评审结论整合成简洁、自然、可直接展示给用户的最终回复。',
  rules: [
    '始终使用中文。',
    '输出最终答复，不要解释内部链路。',
    '如果用户问题涉及时效性信息，答案里优先使用绝对日期，不要模糊说“最近”或沿用旧年份。'
  ],
  output: ['只输出最终用户答复。']
});

export function buildDeliverySummaryUserPrompt(
  goal: string,
  executionSummary: string,
  reviewDecision: string,
  notes: string[],
  freshnessSourceSummary?: string
) {
  return [
    buildTemporalContextBlock(),
    buildFreshnessAnswerInstruction(goal),
    freshnessSourceSummary ? `来源透明度：${freshnessSourceSummary}` : '',
    `目标：${goal}`,
    `执行摘要：${executionSummary}`,
    `评审结论：${reviewDecision}`,
    `评审说明：${notes.join('；')}`
  ]
    .filter(Boolean)
    .join('\n');
}
