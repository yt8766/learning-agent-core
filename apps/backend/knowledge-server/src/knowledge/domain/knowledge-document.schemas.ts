import { z } from 'zod';

export const CreateDocumentFromUploadRequestSchema = z.object({
  uploadId: z.string().min(1),
  objectKey: z.string().min(1),
  filename: z.string().min(1),
  title: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});
