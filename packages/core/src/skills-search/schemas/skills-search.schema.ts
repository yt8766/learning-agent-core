import { z } from 'zod';

import { CapabilityOwnershipRecordSchema } from '../../skills';

export const ConfigureConnectorTemplateIdSchema = z.enum([
  'github-mcp-template',
  'browser-mcp-template',
  'lark-mcp-template'
]);

export const ConfigureConnectorTransportSchema = z.enum(['stdio', 'http']);

export const InstallSkillDtoSchema = z.object({
  manifestId: z.string().optional(),
  sourceId: z.string().optional(),
  actor: z.string().optional()
});

export const RemoteSkillSearchDtoSchema = z.object({
  query: z.string(),
  triggerReason: z.enum(['user_requested', 'capability_gap_detected', 'domain_specialization_needed']).optional(),
  limit: z.number().optional()
});

export const RemoteSkillSearchResultRecordSchema = z.object({
  query: z.string(),
  discoverySource: z.string(),
  triggerReason: z.enum(['user_requested', 'capability_gap_detected', 'domain_specialization_needed']),
  executedAt: z.string(),
  results: z.array(z.unknown())
});

export const InstallRemoteSkillDtoSchema = z.object({
  repo: z.string(),
  skillName: z.string().optional(),
  actor: z.string().optional(),
  detailsUrl: z.string().optional(),
  installCommand: z.string().optional(),
  triggerReason: z.enum(['user_requested', 'capability_gap_detected', 'domain_specialization_needed']).optional(),
  summary: z.string().optional()
});

export const ResolveSkillInstallDtoSchema = z.object({
  actor: z.string().optional(),
  reason: z.string().optional()
});

export const ConfigureConnectorDtoSchema = z.object({
  templateId: ConfigureConnectorTemplateIdSchema,
  transport: ConfigureConnectorTransportSchema,
  displayName: z.string().optional(),
  endpoint: z.string().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  apiKey: z.string().optional(),
  actor: z.string().optional(),
  enabled: z.boolean().optional()
});

export const ConfiguredConnectorRecordSchema = ConfigureConnectorDtoSchema.extend({
  connectorId: z.string(),
  configuredAt: z.string(),
  ownership: CapabilityOwnershipRecordSchema.optional(),
  specialistAffinity: z.array(z.string()).optional(),
  preferredMinistries: z.array(z.string()).optional(),
  bootstrap: z.boolean().optional()
});

export const ConnectorDiscoveryHistoryRecordSchema = z.object({
  connectorId: z.string(),
  discoveredAt: z.string(),
  discoveryMode: z.enum(['registered', 'remote']),
  sessionState: z.enum(['stateless', 'disconnected', 'connected', 'error']),
  discoveredCapabilities: z.array(z.string()),
  error: z.string().optional()
});
