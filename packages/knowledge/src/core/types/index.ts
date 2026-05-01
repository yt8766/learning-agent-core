import type { z } from 'zod';

import type {
  JsonObjectSchema,
  JsonValueSchema,
  KnowledgeBaseSchema,
  KnowledgeModelAdapterSchema,
  KnowledgeModelBindingSchema,
  KnowledgeModelProfileSchema,
  KnowledgeRerankModelBindingSchema,
  KnowledgeTokenUsageSchema,
  ProviderHealthSchema
} from '../schemas';

export type JsonValue = z.infer<typeof JsonValueSchema>;
export type JsonObject = z.infer<typeof JsonObjectSchema>;
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
export type ProviderHealth = z.infer<typeof ProviderHealthSchema>;
export type KnowledgeModelAdapter = z.infer<typeof KnowledgeModelAdapterSchema>;
export type KnowledgeModelBinding = z.infer<typeof KnowledgeModelBindingSchema>;
export type KnowledgeRerankModelBinding = z.infer<typeof KnowledgeRerankModelBindingSchema>;
export type KnowledgeModelProfile = z.infer<typeof KnowledgeModelProfileSchema>;
export type KnowledgeTokenUsage = z.infer<typeof KnowledgeTokenUsageSchema>;
