import { z } from 'zod';

export const HealthCheckResultSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  now: z.string()
});
