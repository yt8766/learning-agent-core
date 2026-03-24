import { z } from 'zod/v4';

import { ActionIntent } from '@agent/shared';

export const ExecutionActionSchema = z.object({
  intent: z
    .enum([ActionIntent.READ_FILE, ActionIntent.WRITE_FILE, ActionIntent.CALL_EXTERNAL_API])
    .describe('工部准备采取的动作意图'),
  toolName: z.string().describe('从注册表选择出的工具名称'),
  rationale: z.string().describe('为什么选择这个工具和动作'),
  actionPrompt: z.string().describe('交给工具执行的动作说明')
});

export type ExecutionActionOutput = z.infer<typeof ExecutionActionSchema>;
