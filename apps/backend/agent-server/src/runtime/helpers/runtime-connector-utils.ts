import { TaskRecord } from '@agent/shared';

export interface BrowserReplayRecord {
  sessionId?: string;
  url?: string;
  snapshotSummary?: string;
  artifactRef?: string;
  snapshotRef?: string;
  screenshotRef?: string;
  stepTrace?: string[];
  steps?: Array<{
    id: string;
    title: string;
    status: 'completed' | 'failed' | 'running';
    at: string;
    summary?: string;
    artifactRef?: string;
  }>;
}

export function extractBrowserReplay(detail?: Record<string, unknown>): BrowserReplayRecord | undefined {
  if (!detail) {
    return undefined;
  }

  const toolName = typeof detail.toolName === 'string' ? detail.toolName : undefined;
  const url =
    typeof detail.url === 'string' ? detail.url : typeof detail.sourceUrl === 'string' ? detail.sourceUrl : undefined;
  const looksLikeBrowserEvidence =
    toolName === 'browse_page' ||
    toolName === 'page_snapshot' ||
    typeof detail.snapshotSummary === 'string' ||
    typeof detail.screenshotRef === 'string' ||
    (Array.isArray(detail.stepTrace) && detail.stepTrace.length > 0);

  if (!looksLikeBrowserEvidence && !url) {
    return undefined;
  }

  const rawStepTrace = Array.isArray(detail.stepTrace)
    ? detail.stepTrace.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    sessionId: typeof detail.sessionId === 'string' ? detail.sessionId : undefined,
    url,
    snapshotSummary:
      typeof detail.snapshotSummary === 'string'
        ? detail.snapshotSummary
        : typeof detail.outputSummary === 'string'
          ? detail.outputSummary
          : typeof detail.summary === 'string'
            ? detail.summary
            : undefined,
    artifactRef: typeof detail.artifactRef === 'string' ? detail.artifactRef : undefined,
    snapshotRef: typeof detail.snapshotRef === 'string' ? detail.snapshotRef : undefined,
    screenshotRef: typeof detail.screenshotRef === 'string' ? detail.screenshotRef : undefined,
    stepTrace: rawStepTrace.length ? rawStepTrace : undefined,
    steps: Array.isArray(detail.steps)
      ? detail.steps
          .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
          .map(item => ({
            id: typeof item.id === 'string' ? item.id : 'step',
            title: typeof item.title === 'string' ? item.title : 'Step',
            status: item.status === 'failed' || item.status === 'running' ? item.status : 'completed',
            at: typeof item.at === 'string' ? item.at : new Date().toISOString(),
            summary: typeof item.summary === 'string' ? item.summary : undefined,
            artifactRef: typeof item.artifactRef === 'string' ? item.artifactRef : undefined
          }))
      : undefined
  };
}

export function describeCapabilityApprovalReason(connectorDisplayName: string, toolName: string, riskLevel: string) {
  if (riskLevel === 'critical') {
    return `${connectorDisplayName} 的 ${toolName} 属于 critical 风险能力，命中强审批策略。`;
  }
  if (riskLevel === 'high') {
    return `${connectorDisplayName} 的 ${toolName} 属于 high 风险能力，执行前必须人工确认。`;
  }
  return `${connectorDisplayName} 的 ${toolName} 被标记为需审批能力，当前策略要求在调用前确认。`;
}

export function taskTouchesCapability(task: TaskRecord, toolName: string): boolean {
  const loweredToolName = toolName.toLowerCase();
  return (task.trace ?? []).some(trace => {
    const summary = String(trace.summary ?? '').toLowerCase();
    const node = String(trace.node ?? '').toLowerCase();
    const data = JSON.stringify(trace.data ?? '').toLowerCase();
    return summary.includes(loweredToolName) || node.includes(loweredToolName) || data.includes(loweredToolName);
  });
}

export function findCapabilityTraceSummary(task: TaskRecord, toolName: string): string | undefined {
  const loweredToolName = toolName.toLowerCase();
  const trace = (task.trace ?? []).find(item => {
    const summary = String(item.summary ?? '').toLowerCase();
    const node = String(item.node ?? '').toLowerCase();
    const data = JSON.stringify(item.data ?? '').toLowerCase();
    return summary.includes(loweredToolName) || node.includes(loweredToolName) || data.includes(loweredToolName);
  });
  return trace?.summary ?? trace?.node;
}
