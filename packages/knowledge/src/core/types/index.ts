import type { z } from 'zod';

import type { JsonObjectSchema, JsonValueSchema, KnowledgeBaseSchema, ProviderHealthSchema } from '../schemas';

export type JsonValue = z.infer<typeof JsonValueSchema>;
export type JsonObject = z.infer<typeof JsonObjectSchema>;
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
export type ProviderHealth = z.infer<typeof ProviderHealthSchema>;
