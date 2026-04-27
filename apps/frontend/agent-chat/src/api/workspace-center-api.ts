import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export interface WorkspaceCenterReadinessSummary {
  workspaceId: string;
  workspaceName: string;
  workspaceStatus: string;
  updatedAt?: string;
  skillDraftCount: number;
  activeDraftCount: number;
  approvedDraftCount: number;
  installedDraftCount: number;
  failedDraftCount: number;
  pendingInstallCount: number;
  highConfidenceDraftCount: number;
  reuseRecordCount: number;
  topDraftTitles: string[];
}

type WorkspaceCenterProjectionLike = {
  workspaceId?: unknown;
  generatedAt?: unknown;
  updatedAt?: unknown;
  skillDrafts?: unknown;
  skillDraftStatusCounts?: unknown;
  reuseRecords?: unknown;
  workspace?: unknown;
  drafts?: unknown;
};

type WorkspaceDraftLike = {
  title?: unknown;
  status?: unknown;
  confidence?: unknown;
  install?: unknown;
};

type WorkspaceInstallLike = {
  status?: unknown;
};

const ACTIVE_DRAFT_STATUSES = new Set(['draft', 'shadow']);
const APPROVED_DRAFT_STATUSES = new Set(['active', 'trusted']);

export async function getWorkspaceCenterReadiness() {
  const response = await http.request<WorkspaceCenterProjectionLike>({
    url: '/platform/workspace-center',
    method: 'GET',
    timeout: 5000
  });

  return normalizeWorkspaceCenterReadiness(response.data);
}

export function normalizeWorkspaceCenterReadiness(
  record: WorkspaceCenterProjectionLike
): WorkspaceCenterReadinessSummary {
  const workspace = asRecord(record.workspace);
  const workspaceSummary = asRecord(workspace.summary);
  const drafts = asArray(record.drafts ?? record.skillDrafts).map(asRecord);
  const reuseRecordCount =
    (Array.isArray(record.reuseRecords) ? record.reuseRecords.length : undefined) ??
    asNumber(workspaceSummary.reuseRecordCount) ??
    0;
  const activeDraftCount =
    asNumber(workspaceSummary.activeDraftCount) ?? countDraftsByStatuses(drafts, ACTIVE_DRAFT_STATUSES);
  const approvedDraftCount =
    asNumber(workspaceSummary.approvedDraftCount) ?? countDraftsByStatuses(drafts, APPROVED_DRAFT_STATUSES);

  return {
    workspaceId: asString(workspace.id) ?? asString(record.workspaceId) ?? 'workspace-platform',
    workspaceName: asString(workspace.name) ?? 'Agent Workspace',
    workspaceStatus: asString(workspace.status) ?? 'unknown',
    updatedAt: asString(workspaceSummary.updatedAt) ?? asString(record.updatedAt) ?? asString(record.generatedAt),
    skillDraftCount: drafts.length,
    activeDraftCount,
    approvedDraftCount,
    installedDraftCount: countInstallStatuses(drafts, new Set(['installed'])),
    failedDraftCount: countInstallStatuses(drafts, new Set(['failed', 'rejected'])),
    pendingInstallCount: countInstallStatuses(drafts, new Set(['pending', 'approved'])),
    highConfidenceDraftCount: drafts.filter(draft => (asNumber(draft.confidence) ?? 0) >= 0.8).length,
    reuseRecordCount,
    topDraftTitles: drafts
      .map(draft => asString(draft.title))
      .filter((title): title is string => Boolean(title))
      .slice(0, 3)
  };
}

function countDraftsByStatuses(drafts: WorkspaceDraftLike[], statuses: Set<string>) {
  return drafts.filter(draft => {
    const status = asString(draft.status);
    return status ? statuses.has(status) : false;
  }).length;
}

function countInstallStatuses(drafts: WorkspaceDraftLike[], statuses: Set<string>) {
  return drafts.filter(draft => {
    const install = asRecord(draft.install) as WorkspaceInstallLike;
    const status = asString(install.status);
    return status ? statuses.has(status) : false;
  }).length;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
