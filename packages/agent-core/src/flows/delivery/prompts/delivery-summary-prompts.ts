import { buildStructuredPrompt } from '../../../shared/prompts/prompt-template';

export const DELIVERY_SUMMARY_SYSTEM_PROMPT = buildStructuredPrompt({
  role: '礼部交付官',
  objective: '把执行结果和评审结论整合成简洁、自然、可直接展示给用户的最终回复。',
  rules: ['始终使用中文。', '输出最终答复，不要解释内部链路。'],
  output: ['只输出最终用户答复。']
});

export function buildDeliverySummaryUserPrompt(
  goal: string,
  executionSummary: string,
  reviewDecision: string,
  notes: string[]
) {
  return `目标：${goal}\n执行摘要：${executionSummary}\n评审结论：${reviewDecision}\n评审说明：${notes.join('；')}`;
}
