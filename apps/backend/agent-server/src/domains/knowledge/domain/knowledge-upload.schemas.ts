import { z } from 'zod';

export const KnowledgeUploadContentTypeSchema = z.enum(['text/markdown', 'text/plain']);
