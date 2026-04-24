import { z } from 'zod/v4';

const IntelTopicModeSchema = z.enum(['patrol', 'ingest']);
const IntelDeliveryKindSchema = z.enum(['alert', 'digest']);

const RawIntelSourcesSchema = z.object({
  defaults: z
    .object({
      recency_hours: z.number().int().positive().default(48)
    })
    .default({ recency_hours: 48 }),
  topics: z.array(
    z.object({
      key: z.string().min(1),
      enabled: z.boolean(),
      mode: IntelTopicModeSchema,
      priority_default: z.enum(['P0', 'P1', 'P2']),
      queries: z.array(z.string().min(1)).min(1)
    })
  )
});

const RawIntelChannelsSchema = z.object({
  channels: z.record(
    z.string(),
    z.object({
      name: z.string().min(1),
      type: z.literal('lark_webhook'),
      webhook_env: z.string().min(1),
      enabled: z.boolean()
    })
  )
});

const RawIntelRoutesSchema = z.object({
  defaults: z
    .object({
      suppress_duplicate_hours: z.number().int().positive().default(24)
    })
    .default({ suppress_duplicate_hours: 24 }),
  rules: z.array(
    z.object({
      id: z.string().min(1),
      enabled: z.boolean(),
      when: z
        .object({
          category_in: z.array(z.string().min(1)).optional(),
          priority_in: z.array(z.enum(['P0', 'P1', 'P2'])).optional(),
          status_in: z.array(z.enum(['pending', 'confirmed', 'closed'])).optional(),
          delivery_kind_in: z.array(IntelDeliveryKindSchema).optional()
        })
        .default({}),
      send_to: z.array(z.string().min(1)).min(1),
      template: z.string().min(1)
    })
  )
});

export const IntelSourcesConfigSchema = RawIntelSourcesSchema.transform(value => ({
  defaults: {
    recencyHours: value.defaults.recency_hours ?? 48
  },
  topics: value.topics.map(topic => ({
    key: topic.key,
    enabled: topic.enabled,
    mode: topic.mode,
    priorityDefault: topic.priority_default,
    queries: topic.queries
  }))
}));

export const IntelChannelsConfigSchema = RawIntelChannelsSchema.transform(value => ({
  channels: Object.fromEntries(
    Object.entries(value.channels).map(([key, channel]) => [
      key,
      {
        name: channel.name,
        type: channel.type,
        webhookEnv: channel.webhook_env,
        enabled: channel.enabled
      }
    ])
  )
}));

export const IntelRoutesConfigSchema = RawIntelRoutesSchema.transform(value => ({
  defaults: {
    suppressDuplicateHours: value.defaults.suppress_duplicate_hours ?? 24
  },
  rules: value.rules.map(rule => ({
    id: rule.id,
    enabled: rule.enabled,
    when: {
      categoryIn: rule.when.category_in ?? [],
      priorityIn: rule.when.priority_in ?? [],
      statusIn: rule.when.status_in ?? [],
      deliveryKindIn: rule.when.delivery_kind_in ?? []
    },
    sendTo: rule.send_to,
    template: rule.template
  }))
}));

export type IntelSourcesConfig = z.infer<typeof IntelSourcesConfigSchema>;
export type IntelChannelsConfig = z.infer<typeof IntelChannelsConfigSchema>;
export type IntelRoutesConfig = z.infer<typeof IntelRoutesConfigSchema>;
