import type { LocalSkillSuggestionRecord, SkillTriggerReason } from './skills-capabilities';

export type SkillSearchStatus = 'not-needed' | 'suggested' | 'auto-installed' | 'blocked';

export interface SkillSearchStateRecord {
  capabilityGapDetected: boolean;
  status: SkillSearchStatus;
  suggestions: LocalSkillSuggestionRecord[];
  safetyNotes: string[];
  query?: string;
  triggerReason?: SkillTriggerReason;
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
}

export interface InstallSkillDto {
  manifestId?: string;
  sourceId?: string;
  actor?: string;
}

export interface RemoteSkillSearchDto {
  query: string;
  triggerReason?: SkillTriggerReason;
  limit?: number;
}

export interface RemoteSkillSearchResultRecord {
  query: string;
  discoverySource: string;
  triggerReason: SkillTriggerReason;
  executedAt: string;
  results: LocalSkillSuggestionRecord[];
}

export interface InstallRemoteSkillDto {
  repo: string;
  skillName?: string;
  actor?: string;
  detailsUrl?: string;
  installCommand?: string;
  triggerReason?: SkillTriggerReason;
  summary?: string;
}

export interface ResolveSkillInstallDto {
  actor?: string;
  reason?: string;
}

export interface ConfigureConnectorDto {
  templateId: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
  transport: 'stdio' | 'http';
  displayName?: string;
  endpoint?: string;
  command?: string;
  args?: string[];
  apiKey?: string;
  actor?: string;
  enabled?: boolean;
}

export interface ConfiguredConnectorRecord extends ConfigureConnectorDto {
  connectorId: string;
  configuredAt: string;
  ownership?: import('./skills-capabilities').CapabilityOwnershipRecord;
  specialistAffinity?: string[];
  preferredMinistries?: import('./primitives').WorkerDomain[];
  bootstrap?: boolean;
}

export interface ConnectorDiscoveryHistoryRecord {
  connectorId: string;
  discoveredAt: string;
  discoveryMode: 'registered' | 'remote';
  sessionState: 'stateless' | 'disconnected' | 'connected' | 'error';
  discoveredCapabilities: string[];
  error?: string;
}
