import { appendJsonSafetyIfMissing } from '../prompts';

interface PromptTemplateOptions {
  role: string;
  objective: string;
  inputs?: string[];
  rules?: string[];
  fieldRules?: string[];
  output?: string[];
  examples?: string[];
  json?: boolean;
}

export function buildStructuredPrompt(options: PromptTemplateOptions) {
  const sections = [
    `你是${options.role}。`,
    `【任务目标】\n${options.objective}`,
    options.inputs?.length ? `【输入说明】\n${options.inputs.map(item => `- ${item}`).join('\n')}` : '',
    options.rules?.length ? `【决策规则】\n${options.rules.map(item => `- ${item}`).join('\n')}` : '',
    options.fieldRules?.length ? `【字段填充规则】\n${options.fieldRules.map(item => `- ${item}`).join('\n')}` : '',
    options.output?.length ? `【输出要求】\n${options.output.map(item => `- ${item}`).join('\n')}` : '',
    options.examples?.length ? `【示例】\n${options.examples.join('\n\n')}` : ''
  ]
    .filter(Boolean)
    .join('\n\n');

  return options.json ? appendJsonSafetyIfMissing(sections) : sections;
}
