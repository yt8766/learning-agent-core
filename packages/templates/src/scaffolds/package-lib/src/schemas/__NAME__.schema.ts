import { z } from 'zod';

export const __CAMEL_NAME__Schema = z.object({
  id: z.string().min(1),
  label: z.string().min(1)
});

export type __PASCAL_NAME__Record = z.infer<typeof __CAMEL_NAME__Schema>;
