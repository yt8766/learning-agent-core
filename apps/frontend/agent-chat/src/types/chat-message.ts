import type { ChatCognitionSnapshot } from '@agent/core';

export type ChatMessageFeedbackRating = 'helpful' | 'unhelpful' | 'none';
export type ChatMessageFeedbackReasonCode = 'too_shallow' | 'incorrect' | 'missed_point' | 'bad_format' | 'other';

export interface ChatMessageFeedbackState {
  rating: ChatMessageFeedbackRating;
  reasonCode?: ChatMessageFeedbackReasonCode;
  comment?: string;
  updatedAt?: string;
}

export interface ChatMessageFeedbackInput {
  rating: ChatMessageFeedbackRating;
  reasonCode?: ChatMessageFeedbackReasonCode;
  comment?: string;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  taskId?: string;
  linkedAgent?: string;
  feedback?: ChatMessageFeedbackState;
  card?:
    | {
        type: 'approval_request';
        intent: string;
        toolName?: string;
        reason?: string;
        reasonCode?: string;
        riskLevel?: string;
        riskCode?: string;
        riskReason?: string;
        commandPreview?: string;
        approvalScope?: 'once' | 'session' | 'always';
        requestedBy?: string;
        status?: 'pending' | 'approved' | 'rejected' | 'allowed';
        displayStatus?: 'pending' | 'allowed' | 'rejected' | 'rejected_with_feedback';
        isPrimaryActionAvailable?: boolean;
        serverId?: string;
        capabilityId?: string;
        interruptId?: string;
        interruptSource?: 'graph' | 'tool';
        interruptMode?: 'blocking' | 'non-blocking';
        resumeStrategy?: 'command' | 'approval-recovery';
        interactionKind?: 'approval' | 'plan-question' | 'supplemental-input';
        watchdog?: boolean;
        runtimeGovernanceReasonCode?: string;
        recommendedActions?: string[];
        preview?: Array<{
          label: string;
          value: string;
        }>;
      }
    | {
        type: 'plan_question';
        title: string;
        summary?: string;
        status?: 'pending' | 'answered' | 'bypassed' | 'aborted';
        interruptId?: string;
        questions: Array<{
          id: string;
          question: string;
          questionType: 'direction' | 'detail' | 'tradeoff';
          options: Array<{
            id: string;
            label: string;
            description: string;
          }>;
          recommendedOptionId?: string;
          allowFreeform?: boolean;
          defaultAssumption?: string;
          whyAsked?: string;
          impactOnPlan?: string;
        }>;
      }
    | {
        type: 'control_notice';
        tone?: 'neutral' | 'success' | 'warning';
        label?: string;
      }
    | {
        type: 'compression_summary';
        summary: string;
        periodOrTopic?: string;
        focuses?: string[];
        keyDeliverables?: string[];
        risks?: string[];
        nextActions?: string[];
        supportingFacts?: string[];
        condensedMessageCount?: number;
        condensedCharacterCount?: number;
        totalCharacterCount?: number;
        previewMessages?: Array<{
          role: 'user' | 'assistant' | 'system';
          content: string;
        }>;
        trigger?: 'message_count' | 'character_count';
        source?: 'heuristic' | 'llm';
      }
    | {
        type: 'evidence_digest';
        sources: Array<{
          id: string;
          sourceType: string;
          sourceUrl?: string;
          trustClass: string;
          summary: string;
          fetchedAt?: string;
          detail?: Record<string, unknown>;
        }>;
      }
    | {
        type: 'learning_summary';
        score: number;
        confidence: 'low' | 'medium' | 'high';
        notes: string[];
        candidateReasons?: string[];
        skippedReasons?: string[];
        conflictDetected?: boolean;
        conflictTargets?: string[];
        derivedFromLayers?: string[];
        policyMode?: string;
        expertiseSignals?: string[];
        skillGovernanceRecommendations: Array<{
          skillId: string;
          recommendation: 'promote' | 'keep-lab' | 'disable' | 'retire';
          successRate?: number;
          promotionState?: string;
        }>;
        recommendedCount: number;
        autoConfirmCount: number;
      }
    | {
        type: 'skill_reuse';
        reusedSkills: string[];
        usedInstalledSkills: string[];
        usedCompanyWorkers: string[];
      }
    | {
        type: 'worker_dispatch';
        currentMinistry?: string;
        currentWorker?: string;
        routeReason?: string;
        chatRoute?: {
          flow: 'supervisor' | 'approval' | 'learning' | 'direct-reply';
          reason: string;
          adapter: string;
          priority: number;
        };
        usedInstalledSkills: string[];
        usedCompanyWorkers: string[];
        connectorRefs?: string[];
        mcpRecommendation?: {
          kind: 'skill' | 'connector' | 'not-needed';
          summary: string;
          reason: string;
          connectorTemplateId?: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
        };
      }
    | {
        type: 'skill_suggestions';
        capabilityGapDetected: boolean;
        status: 'not-needed' | 'suggested' | 'auto-installed' | 'blocked';
        safetyNotes: string[];
        query?: string;
        triggerReason?: 'user_requested' | 'capability_gap_detected' | 'domain_specialization_needed';
        remoteSearch?: {
          query: string;
          discoverySource: string;
          resultCount: number;
          executedAt: string;
        };
        mcpRecommendation?: {
          kind: 'skill' | 'connector' | 'not-needed';
          summary: string;
          reason: string;
          connectorTemplateId?: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
        };
        suggestions: Array<{
          id: string;
          kind: 'installed' | 'manifest' | 'connector-template' | 'remote-skill';
          displayName: string;
          summary: string;
          sourceId?: string;
          score: number;
          availability:
            | 'ready'
            | 'installable'
            | 'installable-local'
            | 'installable-remote'
            | 'approval-required'
            | 'blocked';
          reason: string;
          requiredCapabilities: string[];
          requiredConnectors?: string[];
          version?: string;
          sourceLabel?: string;
          sourceTrustClass?: string;
          installationMode?: 'builtin' | 'configured' | 'marketplace-managed';
          successRate?: number;
          governanceRecommendation?: 'promote' | 'keep-lab' | 'disable' | 'retire';
          repo?: string;
          skillName?: string;
          detailsUrl?: string;
          installCommand?: string;
          discoverySource?: string;
          triggerReason?: 'user_requested' | 'capability_gap_detected' | 'domain_specialization_needed';
          safety?: {
            verdict: 'allow' | 'needs-approval' | 'blocked';
            trustScore: number;
            sourceTrustClass?: string;
            profileCompatible?: boolean;
            maxRiskLevel: string;
            reasons: string[];
            riskyTools: string[];
            missingDeclarations: string[];
          };
          installState?: {
            receiptId: string;
            status: 'requesting' | 'pending' | 'approved' | 'installing' | 'installed' | 'failed' | 'rejected';
            phase?: string;
            result?: string;
            failureCode?: string;
            failureDetail?: string;
            installedAt?: string;
          };
        }>;
      }
    | {
        type: 'runtime_issue';
        severity: 'warning' | 'error';
        title: string;
        notes: string[];
      }
    | {
        type: 'capability_catalog';
        title: string;
        summary?: string;
        groups: Array<{
          key: string;
          label: string;
          kind: 'skill' | 'connector' | 'tool';
          items: Array<{
            id: string;
            displayName: string;
            summary?: string;
            ownerType?: string;
            ownerId?: string;
            scope?: string;
            sourceLabel?: string;
            bootstrap?: boolean;
            enabled?: boolean;
            status?: string;
            family?: string;
            capabilityType?: string;
            preferredMinistries?: string[];
            blockedReason?: string;
          }>;
        }>;
      }
    | {
        type: 'skill_draft_created';
        skillId: string;
        displayName: string;
        description: string;
        ownerType: string;
        scope: string;
        status: string;
        enabled: boolean;
        contract?: {
          requiredTools: string[];
          optionalTools: string[];
          approvalSensitiveTools: string[];
          preferredConnectors: string[];
          requiredConnectors: string[];
        };
        nextActions: string[];
      };
  cognitionSnapshot?: ChatCognitionSnapshot;
  createdAt: string;
}
