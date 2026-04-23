export interface ChatCheckpointPlanningState {
  planMode?: 'intent' | 'implementation' | 'finalized' | 'aborted';
  executionMode?: 'standard' | 'planning-readonly' | 'plan' | 'execute' | 'imperial_direct';
  planModeTransitions?: Array<{
    from?: 'intent' | 'implementation' | 'finalized' | 'aborted';
    to: 'intent' | 'implementation' | 'finalized' | 'aborted';
    reason: string;
    at: string;
  }>;
  planDraft?: {
    summary: string;
    autoResolved: string[];
    openQuestions: string[];
    assumptions: string[];
    decisions?: Array<{
      questionId: string;
      resolutionSource:
        | 'user-answer'
        | 'default-assumption'
        | 'auto-resolved'
        | 'bypass-recommended'
        | 'fallback-assumption';
      selectedOptionId?: string;
      freeform?: string;
      assumedValue?: string;
      whyAsked?: string;
      decisionRationale?: string;
      impactOnPlan?: string;
      answeredAt: string;
    }>;
    questionSet?: {
      title?: string;
      summary?: string;
    };
    questions?: Array<{
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
    maxPlanTurns?: number;
    planTurnsUsed?: number;
    microBudget?: {
      readOnlyToolLimit: number;
      readOnlyToolsUsed: number;
      tokenBudgetUsd?: number;
      budgetTriggered?: boolean;
    };
  };
  modeGateState?: {
    requestedMode?: 'plan' | 'execute' | 'imperial_direct';
    activeMode: 'plan' | 'execute' | 'imperial_direct';
    reason: string;
    updatedAt: string;
  };
  budgetGateState?: {
    node: 'budget_gate';
    status: 'open' | 'soft_blocked' | 'hard_blocked' | 'throttled';
    summary: string;
    queueDepth?: number;
    rateLimitKey?: string;
    triggeredAt?: string;
    updatedAt: string;
  };
  complexTaskPlan?: {
    node: 'complex_task_plan';
    status: 'pending' | 'completed' | 'blocked';
    summary: string;
    subGoals: string[];
    dependencies: Array<{
      from: string;
      to: string;
    }>;
    recoveryPoints?: string[];
    createdAt: string;
    updatedAt: string;
  };
}
