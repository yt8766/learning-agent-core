import type { z } from 'zod';

import type {
  ChatMessageFragmentKindSchema,
  ChatMessageFragmentReferenceSchema,
  ChatMessageFragmentSchema,
  ChatMessageFragmentStatusSchema
} from '../schemas/chat-fragment';

export type ChatMessageFragmentKind = z.infer<typeof ChatMessageFragmentKindSchema>;
export type ChatMessageFragmentStatus = z.infer<typeof ChatMessageFragmentStatusSchema>;
export type ChatMessageFragmentReference = z.infer<typeof ChatMessageFragmentReferenceSchema>;
export type ChatMessageFragment = z.infer<typeof ChatMessageFragmentSchema>;
