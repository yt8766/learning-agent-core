export interface ChatCheckpointCapabilityState {
  capabilityAugmentations?: Array<{
    id: string;
    kind: 'skill' | 'connector' | 'tool' | 'both' | 'none';
    status: 'suggested' | 'waiting_approval' | 'installing' | 'configuring' | 'ready' | 'failed' | 'blocked';
    requestedBy: 'user' | 'supervisor' | 'specialist' | 'workflow';
    target?: string;
    reason: string;
    summary?: string;
    owner: {
      ownerType: 'shared' | 'ministry-owned' | 'specialist-owned' | 'user-attached' | 'runtime-derived';
      ownerId?: string;
      capabilityType: 'skill' | 'connector' | 'tool';
      scope: 'task' | 'session' | 'workspace';
      trigger:
        | 'bootstrap'
        | 'user_requested'
        | 'specialist_requested'
        | 'capability_gap_detected'
        | 'workflow_required';
      consumedByMinistry?: string;
      consumedBySpecialist?: string;
    };
    createdAt: string;
    updatedAt: string;
  }>;
  currentSkillExecution?: {
    skillId: string;
    displayName: string;
    phase: 'research' | 'execute';
    stepIndex: number;
    totalSteps: number;
    title: string;
    instruction: string;
    toolNames?: string[];
    updatedAt: string;
  };
  learningEvaluation?: {
    score: number;
    confidence: 'low' | 'medium' | 'high';
    notes: string[];
    governanceWarnings?: string[];
    candidateReasons?: string[];
    skippedReasons?: string[];
    conflictDetected?: boolean;
    conflictTargets?: string[];
    derivedFromLayers?: string[];
    policyMode?: string;
    expertiseSignals?: string[];
    skillGovernanceRecommendations?: Array<{
      skillId: string;
      recommendation: 'promote' | 'keep-lab' | 'disable' | 'retire';
      successRate?: number;
      promotionState?: string;
    }>;
    recommendedCandidateIds: string[];
    autoConfirmCandidateIds: string[];
    sourceSummary: {
      externalSourceCount: number;
      internalSourceCount: number;
      reusedMemoryCount: number;
      reusedRuleCount: number;
      reusedSkillCount: number;
    };
  };
  governanceScore?: {
    ministry: 'libu-governance';
    score: number;
    status: 'healthy' | 'watch' | 'risky';
    summary: string;
    rationale: string[];
    recommendedLearningTargets: Array<'memory' | 'rule' | 'skill'>;
    trustAdjustment: 'promote' | 'hold' | 'downgrade';
    updatedAt: string;
  };
  governanceReport?: {
    ministry: 'libu-governance';
    summary: string;
    executionQuality: {
      score: number;
      summary: string;
    };
    evidenceSufficiency: {
      score: number;
      summary: string;
    };
    sandboxReliability: {
      score: number;
      summary: string;
    };
    reviewOutcome: {
      decision: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
      summary: string;
    };
    interruptLoad: {
      interruptCount: number;
      microLoopCount: number;
      summary: string;
    };
    businessFeedback: {
      score: number;
      summary: string;
    };
    recommendedLearningTargets: Array<'memory' | 'rule' | 'skill'>;
    trustAdjustment: 'promote' | 'hold' | 'downgrade';
    updatedAt: string;
  };
  skillSearch?: {
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
  };
}
