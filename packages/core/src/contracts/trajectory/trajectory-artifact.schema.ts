import { z } from 'zod';

import { TrajectoryArtifactKindSchema } from './trajectory-enums.schema';
import { TrajectoryPublicIdSchema, TrajectoryTimestampSchema } from './trajectory-scalars.schema';

export const TrajectoryArtifactRecordSchema = z.object({
  artifactId: TrajectoryPublicIdSchema,
  taskId: TrajectoryPublicIdSchema,
  kind: TrajectoryArtifactKindSchema,
  uri: z.string().optional(),
  title: z.string(),
  summary: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().nonnegative().optional(),
  checksum: z.string().optional(),
  createdAt: TrajectoryTimestampSchema,
  metadata: z.record(z.string(), z.unknown()).optional()
});
export type TrajectoryArtifactRecord = z.infer<typeof TrajectoryArtifactRecordSchema>;
