import { z } from 'zod';

import { RiskLevelSchema } from '../../primitives';
import { CapabilityOwnershipRecordSchema } from './capability';
import {
  ProfilePolicyHintRecordSchema,
  SkillSafetyEvaluationRecordSchema,
  SkillSuggestionAvailabilitySchema,
  SkillSuggestionKindSchema,
  SkillTriggerReasonSchema
} from './safety';

const SkillSourceKindSchema = z.enum(['marketplace', 'internal', 'git', 'http-manifest']);
const SkillSourceDiscoveryModeSchema = z.enum(['local-dir', 'remote-index', 'git-registry', 'http-manifest']);
const SkillSourceSyncStrategySchema = z.enum(['manual', 'scheduled', 'on-demand']);
const SkillSourcePrioritySchema = z.enum(['workspace/internal', 'managed/local', 'bundled/marketplace']);
export const SourcePolicyModeSchema = z.enum(['internal-only', 'controlled-first', 'open-web-allowed']);
const WorkflowApprovalPolicySchema = z.enum(['none', 'high-risk-only', 'all-actions']);
export const WorkerKindSchema = z.enum(['core', 'company', 'installed-skill']);
export const WorkerDomainSchema = z.enum([
  'libu-governance',
  'hubu-search',
  'libu-delivery',
  'bingbu-ops',
  'xingbu-review',
  'gongbu-code',
  'libu-router',
  'libu-docs'
]);
export const SpecialistDomainSchema = z.enum([
  'general-assistant',
  'product-strategy',
  'growth-marketing',
  'payment-channel',
  'risk-compliance',
  'technical-architecture',
  'live-ops'
]);

export const WorkerDefinitionSchema = z.object({
  id: z.string(),
  ministry: WorkerDomainSchema,
  kind: WorkerKindSchema.optional(),
  displayName: z.string(),
  defaultModel: z.string(),
  supportedCapabilities: z.array(z.string()),
  reviewPolicy: z.enum(['none', 'self-check', 'mandatory-xingbu']),
  sourceId: z.string().optional(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
  requiredConnectors: z.array(z.string()).optional(),
  preferredContexts: z.array(z.string()).optional(),
  allowedSourcePolicies: z.array(SourcePolicyModeSchema).optional()
});

export const SkillSourceRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: SkillSourceKindSchema,
  baseUrl: z.string(),
  discoveryMode: SkillSourceDiscoveryModeSchema.optional(),
  indexUrl: z.string().optional(),
  packageBaseUrl: z.string().optional(),
  authRef: z.string().optional(),
  syncStrategy: SkillSourceSyncStrategySchema.optional(),
  allowedProfiles: z.array(ProfilePolicyHintRecordSchema.shape.recommendedForProfiles.element).optional(),
  trustClass: z.enum(['official', 'curated', 'community', 'unverified', 'internal']),
  priority: SkillSourcePrioritySchema,
  enabled: z.boolean(),
  authMode: z.enum(['none', 'token', 'oauth', 'header']).optional(),
  lastSyncedAt: z.string().optional(),
  healthState: z.enum(['healthy', 'degraded', 'error', 'unknown', 'disabled']).optional(),
  healthReason: z.string().optional(),
  profilePolicy: ProfilePolicyHintRecordSchema.optional()
});

export const SkillManifestRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  publisher: z.string(),
  sourceId: z.string(),
  requiredCapabilities: z.array(z.string()),
  requiredConnectors: z.array(z.string()).optional(),
  allowedTools: z.array(z.string()).optional(),
  sourcePolicy: z
    .object({
      mode: SourcePolicyModeSchema,
      preferredUrls: z.array(z.string()).optional()
    })
    .optional(),
  approvalPolicy: WorkflowApprovalPolicySchema,
  riskLevel: RiskLevelSchema,
  entry: z.string(),
  artifactUrl: z.string().optional(),
  readmeUrl: z.string().optional(),
  homepageUrl: z.string().optional(),
  integrity: z.string().optional(),
  integrityAlgorithm: z.string().optional(),
  publishedAt: z.string().optional(),
  sourceRef: z.string().optional(),
  sizeBytes: z.number().optional(),
  summary: z.string().optional(),
  license: z.string().optional(),
  compatibility: z.string().optional(),
  installHints: z
    .object({
      requiresApproval: z.boolean().optional(),
      requiredEnv: z.array(z.string()).optional(),
      postInstallSteps: z.array(z.string()).optional()
    })
    .optional(),
  bootstrap: z.boolean().optional(),
  ownership: CapabilityOwnershipRecordSchema.optional(),
  domains: z.array(z.string()).optional(),
  specialistAffinity: z.array(z.string()).optional(),
  preferredMinistries: z.array(WorkerDomainSchema).optional(),
  preferredConnectors: z.array(z.string()).optional(),
  triggers: z.array(z.string()).optional(),
  recommendedSpecialists: z.array(SpecialistDomainSchema).optional(),
  executionHints: z.array(z.string()).optional(),
  compressionHints: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  safety: SkillSafetyEvaluationRecordSchema.optional()
});

export const InstalledSkillRecordSchema = z.object({
  skillId: z.string(),
  version: z.string(),
  sourceId: z.string(),
  installLocation: z.string(),
  installedAt: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'installed', 'failed']),
  receiptId: z.string(),
  ownership: CapabilityOwnershipRecordSchema.optional(),
  governanceRecommendation: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  compatibility: z.string().optional(),
  activeTaskCount: z.number().optional(),
  totalTaskCount: z.number().optional(),
  recentTaskGoals: z.array(z.string()).optional(),
  firstUsedAt: z.string().optional(),
  lastUsedAt: z.string().optional(),
  successRate: z.number().optional(),
  lastOutcome: z.enum(['success', 'failure']).optional(),
  recentFailureReason: z.string().optional(),
  recentTasks: z
    .array(
      z.object({
        taskId: z.string(),
        goal: z.string(),
        status: z.string(),
        approvalCount: z.number(),
        latestTraceSummary: z.string().optional()
      })
    )
    .optional()
});

export const SkillInstallReceiptSchema = z.object({
  id: z.string(),
  skillId: z.string(),
  version: z.string(),
  sourceId: z.string(),
  phase: z
    .enum([
      'searching',
      'requested',
      'suggested',
      'approved',
      'downloading',
      'verifying',
      'installing',
      'installed',
      'failed'
    ])
    .optional(),
  integrity: z.string().optional(),
  approvedBy: z.string().optional(),
  rejectedBy: z.string().optional(),
  reason: z.string().optional(),
  downloadRef: z.string().optional(),
  failureCode: z.string().optional(),
  failureDetail: z.string().optional(),
  installedAt: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'installed', 'failed']),
  result: z.string().optional(),
  repo: z.string().optional(),
  skillName: z.string().optional(),
  detailsUrl: z.string().optional(),
  installCommand: z.string().optional(),
  triggerReason: SkillTriggerReasonSchema.optional()
});

export const CompanyAgentRecordSchema = z.object({
  id: z.string(),
  enabled: z.boolean().optional(),
  ministry: z.string(),
  kind: z.string().optional(),
  displayName: z.string(),
  defaultModel: z.string(),
  supportedCapabilities: z.array(z.string()),
  reviewPolicy: z.string(),
  sourceId: z.string().optional(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
  requiredConnectors: z.array(z.string()).optional(),
  activeTaskCount: z.number().optional(),
  totalTaskCount: z.number().optional(),
  successRate: z.number().optional(),
  promotionState: z.string().optional(),
  sourceRuns: z.array(z.string()).optional(),
  recentTaskGoals: z.array(z.string()).optional(),
  governanceStatus: z.string().optional()
});

export const LocalSkillSuggestionRecordSchema = z.object({
  id: z.string(),
  kind: SkillSuggestionKindSchema,
  displayName: z.string(),
  summary: z.string(),
  sourceId: z.string().optional(),
  score: z.number(),
  availability: SkillSuggestionAvailabilitySchema,
  reason: z.string(),
  requiredCapabilities: z.array(z.string()),
  requiredConnectors: z.array(z.string()).optional(),
  version: z.string().optional(),
  sourceLabel: z.string().optional(),
  sourceTrustClass: z.string().optional(),
  installationMode: z.enum(['builtin', 'configured', 'marketplace-managed']).optional(),
  successRate: z.number().optional(),
  governanceRecommendation: z.enum(['promote', 'keep-lab', 'disable', 'retire']).optional(),
  safety: SkillSafetyEvaluationRecordSchema.optional(),
  repo: z.string().optional(),
  skillName: z.string().optional(),
  detailsUrl: z.string().optional(),
  installCommand: z.string().optional(),
  discoverySource: z.string().optional(),
  triggerReason: SkillTriggerReasonSchema.optional(),
  bootstrap: z.boolean().optional(),
  ownership: CapabilityOwnershipRecordSchema.optional(),
  domains: z.array(z.string()).optional(),
  specialistAffinity: z.array(z.string()).optional(),
  preferredMinistries: z.array(z.string()).optional(),
  preferredConnectors: z.array(z.string()).optional(),
  allowedTools: z.array(z.string()).optional(),
  triggers: z.array(z.string()).optional(),
  recommendedSpecialists: z.array(z.string()).optional(),
  executionHints: z.array(z.string()).optional(),
  compressionHints: z.array(z.string()).optional()
});

export const SkillSearchStatusSchema = z.enum(['not-needed', 'suggested', 'auto-installed', 'blocked']);

export const SkillSearchRemoteSearchRecordSchema = z.object({
  query: z.string(),
  discoverySource: z.string(),
  resultCount: z.number(),
  executedAt: z.string()
});

export const SkillSearchMcpRecommendationSchema = z.object({
  kind: z.enum(['skill', 'connector', 'not-needed']),
  summary: z.string(),
  reason: z.string(),
  connectorTemplateId: z.enum(['github-mcp-template', 'browser-mcp-template', 'lark-mcp-template']).optional()
});

export const SkillSearchStateRecordSchema = z.object({
  capabilityGapDetected: z.boolean(),
  status: SkillSearchStatusSchema,
  suggestions: z.array(LocalSkillSuggestionRecordSchema),
  safetyNotes: z.array(z.string()),
  query: z.string().optional(),
  triggerReason: SkillTriggerReasonSchema.optional(),
  remoteSearch: SkillSearchRemoteSearchRecordSchema.optional(),
  mcpRecommendation: SkillSearchMcpRecommendationSchema.optional()
});
