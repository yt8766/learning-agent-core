export interface RuntimeCenterToolFamilyRecord {
  id: string;
  displayName: string;
  description: string;
  capabilityType: string;
  ownerType: string;
  ownerId?: string;
  bootstrap?: boolean;
  preferredMinistries?: string[];
  preferredSpecialists?: string[];
  toolCount: number;
}

export interface RuntimeCenterToolRecord {
  name: string;
  description: string;
  family: string;
  familyDisplayName: string;
  category: string;
  riskLevel: string;
  requiresApproval: boolean;
  timeoutMs: number;
  sandboxProfile: string;
  ownerType?: string;
  ownerId?: string;
  bootstrap?: boolean;
  preferredMinistries?: string[];
  preferredSpecialists?: string[];
  capabilityType: string;
  usageCount: number;
  blockedCount: number;
}

export interface RuntimeCenterToolUsageRecord {
  toolName: string;
  family: string;
  capabilityType: string;
  status: string;
  route: string;
  requestedBy?: string;
  reason?: string;
  blockedReason?: string;
  approvalRequired?: boolean;
  riskLevel?: string;
  usedAt: string;
}

export interface RuntimeCenterToolsRecord {
  totalTools: number;
  familyCount: number;
  blockedToolCount: number;
  approvalRequiredCount: number;
  mcpBackedCount: number;
  governanceToolCount: number;
  families: RuntimeCenterToolFamilyRecord[];
  tools: RuntimeCenterToolRecord[];
  attachments: Array<{
    toolName: string;
    family: string;
    ownerType: string;
    ownerId?: string;
    attachedAt: string;
    attachedBy: string;
    preferred: boolean;
    reason?: string;
  }>;
  recentUsage: RuntimeCenterToolUsageRecord[];
  blockedReasons: RuntimeCenterToolUsageRecord[];
}
