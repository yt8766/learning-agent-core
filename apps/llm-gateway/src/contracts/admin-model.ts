import { z } from 'zod';

export const GatewayModelCapabilitySchema = z.enum([
  'chat_completions',
  'streaming',
  'json_mode',
  'tool_calling',
  'vision',
  'embeddings'
]);

const LowercaseSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const NonnegativeNullablePriceSchema = z.number().nonnegative().nullable();

const GatewayModelAdminBaseSchema = z
  .object({
    alias: LowercaseSlugSchema,
    providerId: z.string().min(1),
    providerModel: z.string().min(1),
    enabled: z.boolean(),
    contextWindow: z.number().int().positive(),
    inputPricePer1mTokens: NonnegativeNullablePriceSchema,
    outputPricePer1mTokens: NonnegativeNullablePriceSchema,
    capabilities: z.array(GatewayModelCapabilitySchema),
    fallbackAliases: z.array(z.string().min(1)),
    adminOnly: z.boolean()
  })
  .strict();

export const GatewayModelAdminRecordSchema = GatewayModelAdminBaseSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const UpsertGatewayModelRequestSchema = GatewayModelAdminBaseSchema;

export type GatewayModelCapability = z.infer<typeof GatewayModelCapabilitySchema>;
export type GatewayModelAdminRecord = z.infer<typeof GatewayModelAdminRecordSchema>;
export type UpsertGatewayModelRequest = z.infer<typeof UpsertGatewayModelRequestSchema>;
