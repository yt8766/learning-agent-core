export interface ChatCheckpointObservabilityState {
  blackboardState?: {
    node: 'blackboard_state';
    taskId: string;
    sessionId?: string;
    visibleScopes: Array<'supervisor' | 'strategy' | 'ministry' | 'fallback' | 'governance'>;
    refs: {
      traceCount: number;
      evidenceCount: number;
      checkpointId?: string;
      activeInterruptId?: string;
    };
    updatedAt: string;
  };
  contextFilterState?: {
    node: 'context_filter';
    status: 'pending' | 'completed' | 'blocked';
    filteredContextSlice: {
      summary: string;
      historyTraceCount: number;
      evidenceCount: number;
      specialistCount: number;
      ministryCount: number;
      compressionApplied?: boolean;
      compressionSource?: 'heuristic' | 'llm';
      compressedMessageCount?: number;
    };
    audienceSlices?: {
      strategy: {
        summary: string;
        dispatchCount: number;
      };
      ministry: {
        summary: string;
        dispatchCount: number;
      };
      fallback: {
        summary: string;
        dispatchCount: number;
      };
    };
    dispatchOrder?: Array<'strategy' | 'ministry' | 'fallback'>;
    noiseGuards?: string[];
    hiddenTraceCount?: number;
    redactedKeys?: string[];
    createdAt: string;
    updatedAt: string;
  };
  streamStatus?: {
    nodeId?: string;
    nodeLabel?: string;
    detail?: string;
    progressPercent?: number;
    updatedAt: string;
  };
  guardrailState?: {
    stage: 'pre' | 'post';
    verdict: 'pass_through' | 'rewrite_required' | 'block';
    summary: string;
    eventId?: string;
    updatedAt: string;
  };
  criticState?: {
    node: 'critic';
    decision: 'pass_through' | 'rewrite_required';
    summary: string;
    blockingIssues?: string[];
    createdAt: string;
    updatedAt: string;
  };
  sandboxState?: {
    node: 'sandbox';
    stage: 'gongbu' | 'bingbu' | 'review';
    status: 'idle' | 'running' | 'passed' | 'failed' | 'exhausted';
    attempt: number;
    maxAttempts: number;
    verdict?: 'safe' | 'unsafe' | 'retry';
    exhaustedReason?: string;
    updatedAt: string;
  };
  knowledgeIngestionState?: {
    node: 'knowledge_ingestion';
    store: 'wenyuan' | 'cangjing';
    sourceId?: string;
    receiptId?: string;
    status: 'idle' | 'queued' | 'processing' | 'completed' | 'partial' | 'failed';
    updatedAt: string;
  };
  knowledgeIndexState?: {
    node: 'knowledge_index';
    store: 'wenyuan' | 'cangjing';
    indexStatus: 'ready' | 'partial' | 'building' | 'failed';
    searchableDocumentCount?: number;
    blockedDocumentCount?: number;
    updatedAt: string;
  };
  finalReviewState?: {
    node: 'final_review';
    ministry: string;
    decision: 'pass' | 'revise_required' | 'block';
    summary: string;
    interruptRequired: boolean;
    deliveryStatus?: 'pending' | 'delivered' | 'interrupted';
    deliveryMinistry?: string;
    createdAt: string;
    updatedAt: string;
  };
}
