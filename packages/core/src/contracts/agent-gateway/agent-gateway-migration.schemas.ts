import { z } from 'zod';

export const GatewayMigrationResourceKindSchema = z.enum([
  'config',
  'providerConfig',
  'authFile',
  'apiKey',
  'quota',
  'oauthPolicy',
  'modelAlias',
  'requestLog'
]);

export const GatewayMigrationResourceActionSchema = z.enum(['create', 'update', 'skip', 'conflict']);

export const GatewayMigrationResourcePreviewSchema = z
  .object({
    kind: GatewayMigrationResourceKindSchema,
    sourceId: z.string().min(1),
    targetId: z.string().min(1).nullable(),
    action: GatewayMigrationResourceActionSchema,
    safe: z.boolean(),
    summary: z.string().min(1)
  })
  .strict();

export const GatewayMigrationConflictSchema = z
  .object({
    kind: GatewayMigrationResourceKindSchema,
    sourceId: z.string().min(1),
    targetId: z.string().min(1),
    reason: z.string().min(1),
    resolution: z.enum(['skip', 'overwrite', 'rename', 'manual'])
  })
  .strict();

export const GatewayMigrationPreviewSchema = z
  .object({
    source: z
      .object({
        apiBase: z.string().min(1),
        serverVersion: z.string().nullable(),
        checkedAt: z.string().min(1)
      })
      .strict(),
    resources: z.array(GatewayMigrationResourcePreviewSchema),
    conflicts: z.array(GatewayMigrationConflictSchema),
    totals: z
      .object({
        create: z.number().int().nonnegative(),
        update: z.number().int().nonnegative(),
        skip: z.number().int().nonnegative(),
        conflict: z.number().int().nonnegative()
      })
      .strict()
  })
  .strict();

export const GatewayMigrationApplyItemSchema = z
  .object({
    kind: GatewayMigrationResourceKindSchema,
    targetId: z.string().min(1),
    sourceId: z.string().min(1).optional(),
    reason: z.string().min(1).optional()
  })
  .strict();

export const GatewayMigrationApplyFailureSchema = z
  .object({
    kind: GatewayMigrationResourceKindSchema,
    sourceId: z.string().min(1),
    reason: z.string().min(1)
  })
  .strict();

export const GatewayMigrationApplyResponseSchema = z
  .object({
    migrationId: z.string().min(1),
    appliedAt: z.string().min(1),
    imported: z.array(GatewayMigrationApplyItemSchema),
    skipped: z.array(GatewayMigrationApplyItemSchema),
    failed: z.array(GatewayMigrationApplyFailureSchema),
    warnings: z.array(z.string().min(1)).default([])
  })
  .strict();
