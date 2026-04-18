import type { __PASCAL_NAME__GraphInput } from '../../../graphs/__NAME__.graph';

export function build__PASCAL_NAME__Prompt(input: __PASCAL_NAME__GraphInput) {
  return `You are the __TITLE__ agent. Goal: ${input.goal}`;
}
