export type SandboxDecision = 'allow' | 'require_approval' | 'deny';
export type SandboxRiskClass = 'low' | 'medium' | 'high' | 'critical';
export type SandboxRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'blocked' | 'cancelled' | 'exhausted';
export type SandboxVerdict = 'allow' | 'warn' | 'block' | 'unknown';
export type SandboxApprovalAction = 'approve' | 'reject' | 'feedback' | 'input' | 'bypass' | 'abort';

export interface SandboxPermissionScope {
  workspaceRoot?: string;
  allowedPaths: string[];
  deniedPaths: string[];
  allowedHosts: string[];
  deniedHosts: string[];
  allowedCommands: string[];
  deniedCommands: string[];
}

export interface SandboxProfileRecord {
  profile: string;
  description: string;
  writableWorkspace: boolean;
  networkAccess: 'disabled' | 'restricted' | 'enabled';
  requiresApproval: boolean;
  riskClass: SandboxRiskClass;
}

export interface SandboxApprovalProjection {
  approvalId: string;
  interruptId: string;
  resumeEndpoint: string;
}

export interface SandboxRunRecord {
  runId: string;
  requestId?: string;
  taskId: string;
  sessionId?: string;
  profile: string;
  stage: 'preflight' | 'prepare' | 'execute' | 'execution' | 'verify' | 'cleanup';
  status: SandboxRunStatus;
  attempt: number;
  maxAttempts: number;
  verdict?: SandboxVerdict;
  exhaustedReason?: string;
  outputPreview?: string;
  evidenceIds?: string[];
  artifactIds?: string[];
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface SandboxPreflightResponse {
  decision: SandboxDecision;
  reasonCode: string;
  reason: string;
  profile: string;
  normalizedPermissionScope: SandboxPermissionScope;
  requiresApproval: boolean;
  run: SandboxRunRecord;
  approval?: SandboxApprovalProjection;
}

export interface SandboxRunApprovalRequest {
  sessionId: string;
  actor?: string;
  reason?: string;
  interrupt: {
    interruptId?: string;
    action: SandboxApprovalAction;
    runId?: string;
    requestId?: string;
    approvalId?: string;
    feedback?: string;
    value?: string;
    payload?: Record<string, unknown> & {
      permissionScopePatch?: Partial<SandboxPermissionScope>;
      maxAttemptsOverride?: number;
      approvalScope?: 'once' | 'session' | 'always';
      reasonCode?: string;
    };
  };
}
