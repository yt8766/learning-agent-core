import { __CAMEL_NAME__OutputSchema, type __PASCAL_NAME__Output } from '../flows/__NAME__/schemas/__NAME__.schema';
import { build__PASCAL_NAME__Prompt } from '../flows/__NAME__/prompts/__NAME__-prompt';

export interface __PASCAL_NAME__GraphInput {
  goal: string;
}

export interface __PASCAL_NAME__GraphResult {
  prompt: string;
  output: __PASCAL_NAME__Output;
}

export function run__PASCAL_NAME__Graph(input: __PASCAL_NAME__GraphInput): __PASCAL_NAME__GraphResult {
  const prompt = build__PASCAL_NAME__Prompt(input);
  const output = __CAMEL_NAME__OutputSchema.parse({
    summary: `Prepared ${input.goal} with __TITLE__`,
    nextAction: 'review-generated-plan'
  });

  return {
    prompt,
    output
  };
}
