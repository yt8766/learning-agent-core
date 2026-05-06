import { z } from 'zod';

import type {
  KnowledgeBaseRoutingCandidate,
  KnowledgeBaseRoutingDecision,
  KnowledgeRagJsonValue,
  KnowledgeRetrievalStrategyHints
} from '../schemas/knowledge-rag-planning.schema';
import {
  KnowledgeBaseRoutingDecisionSchema,
  KnowledgeBaseRoutingCandidateSchema,
  KnowledgeRagJsonValueSchema,
  KnowledgeRetrievalStrategyHintsSchema
} from '../schemas/knowledge-rag-planning.schema';
import type { KnowledgeRagPolicy, KnowledgeRagSearchMode } from '../schemas/knowledge-rag-policy.schema';
import { KnowledgeRagPolicySchema, KnowledgeRagSearchModeSchema } from '../schemas/knowledge-rag-policy.schema';

export const KnowledgePlannerConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string()
});

export const KnowledgePlannerConversationSchema = z.object({
  summary: z.string().optional(),
  recentMessages: z.array(KnowledgePlannerConversationMessageSchema).optional()
});

export const KnowledgeStructuredPlannerProviderInputSchema = z.object({
  query: z.string(),
  conversation: KnowledgePlannerConversationSchema.optional(),
  accessibleKnowledgeBases: z.array(KnowledgeBaseRoutingCandidateSchema),
  policy: KnowledgeRagPolicySchema,
  metadata: z.record(z.string(), KnowledgeRagJsonValueSchema).optional()
});

export const KnowledgeStructuredPlannerProviderResultSchema = z.object({
  rewrittenQuery: z.string().optional(),
  queryVariants: z.array(z.string()).optional(),
  selectedKnowledgeBaseIds: z.array(z.string()),
  searchMode: KnowledgeRagSearchModeSchema.optional(),
  selectionReason: z.string(),
  confidence: z.number().min(0).max(1),
  routingDecisions: z.array(KnowledgeBaseRoutingDecisionSchema).optional(),
  strategyHints: KnowledgeRetrievalStrategyHintsSchema.optional(),
  metadata: z.record(z.string(), KnowledgeRagJsonValueSchema).optional()
});

export interface KnowledgeStructuredPlannerProviderInput {
  query: string;
  conversation?: {
    summary?: string;
    recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
  accessibleKnowledgeBases: KnowledgeBaseRoutingCandidate[];
  policy: KnowledgeRagPolicy;
  metadata?: Record<string, KnowledgeRagJsonValue>;
}

export interface KnowledgeStructuredPlannerProviderResult {
  rewrittenQuery?: string;
  queryVariants?: string[];
  selectedKnowledgeBaseIds: string[];
  searchMode?: KnowledgeRagSearchMode;
  selectionReason: string;
  confidence: number;
  routingDecisions?: KnowledgeBaseRoutingDecision[];
  strategyHints?: KnowledgeRetrievalStrategyHints;
  metadata?: Record<string, KnowledgeRagJsonValue>;
}

export interface KnowledgeStructuredPlannerProvider {
  plan(input: KnowledgeStructuredPlannerProviderInput): Promise<KnowledgeStructuredPlannerProviderResult>;
}
