import { z } from 'zod';

export const __CAMEL_NAME__OutputSchema = z.object({
  summary: z.string().min(1),
  nextAction: z.string().min(1)
});

export type __PASCAL_NAME__Output = z.infer<typeof __CAMEL_NAME__OutputSchema>;
