import type { ActionIntent, ApprovalInterruptRecord, PendingApprovalRecord, RiskLevel } from '@agent/shared';

type ApprovalScope = 'once' | 'session' | 'always';

const DESTRUCTIVE_COMMAND_PATTERN =
  /\b(rm\s+-rf|rm\s+-r|del\s+\/s|del\s+\/q|rmdir\s+\/s|chmod\s+777|chown\s+-R|mkfs|dd\s+if=|shutdown|reboot)\b/i;
const PERMISSION_ESCALATION_PATTERN = /\b(sudo|su|doas|runas)\b/i;
const EXTERNAL_MUTATION_PATTERN = /\b(curl|wget|http|fetch|axios).*(post|put|patch|delete|publish|deploy)/i;

export function buildRiskApprovalMetadata(params: {
  intent?: ActionIntent | string;
  riskLevel?: RiskLevel;
  toolName?: string;
  reason?: string;
  requestedBy?: string;
  preview?: Array<{ label: string; value: string }>;
  approvalScope?: ApprovalScope;
}) {
  const commandPreview = buildCommandPreview(params.preview);
  const risk = classifyInterruptRisk({
    intent: params.intent,
    riskLevel: params.riskLevel,
    toolName: params.toolName,
    reason: params.reason,
    commandPreview
  });

  return {
    commandPreview,
    riskReason: risk.riskReason,
    riskCode: risk.riskCode,
    approvalScope: params.approvalScope ?? 'once',
    requestedBy: params.requestedBy
  };
}

export function extendPendingApprovalWithRiskMetadata(
  approval: PendingApprovalRecord,
  params: {
    requestedBy?: string;
    approvalScope?: ApprovalScope;
  }
): PendingApprovalRecord {
  const riskMetadata = buildRiskApprovalMetadata({
    intent: approval.intent,
    riskLevel: approval.riskLevel,
    toolName: approval.toolName,
    reason: approval.reason,
    requestedBy: params.requestedBy ?? approval.requestedBy,
    preview: approval.preview,
    approvalScope: params.approvalScope
  });
  return {
    ...approval,
    reasonCode: approval.reasonCode ?? riskMetadata.riskCode,
    preview: mergePreviewItems(approval.preview, [
      ['Command', riskMetadata.commandPreview],
      ['Risk', riskMetadata.riskReason],
      ['Approval scope', riskMetadata.approvalScope],
      ['Requested by', riskMetadata.requestedBy]
    ])
  };
}

export function extendInterruptWithRiskMetadata(
  interrupt: ApprovalInterruptRecord,
  params?: {
    approvalScope?: ApprovalScope;
  }
): ApprovalInterruptRecord {
  const preview = interrupt.preview ?? [];
  const riskMetadata = buildRiskApprovalMetadata({
    intent: interrupt.intent,
    riskLevel: interrupt.riskLevel,
    toolName: interrupt.toolName,
    reason: interrupt.reason,
    requestedBy: interrupt.requestedBy,
    preview,
    approvalScope: params?.approvalScope
  });

  return {
    ...interrupt,
    preview: mergePreviewItems(preview, [
      ['Command', riskMetadata.commandPreview],
      ['Risk', riskMetadata.riskReason],
      ['Approval scope', riskMetadata.approvalScope]
    ]),
    payload: {
      ...(interrupt.payload ?? {}),
      commandPreview: riskMetadata.commandPreview,
      riskReason: riskMetadata.riskReason,
      riskCode: riskMetadata.riskCode,
      approvalScope: riskMetadata.approvalScope
    }
  };
}

function classifyInterruptRisk(params: {
  intent?: ActionIntent | string;
  riskLevel?: RiskLevel;
  toolName?: string;
  reason?: string;
  commandPreview?: string;
}) {
  const normalized = [params.toolName, params.reason, params.commandPreview].filter(Boolean).join(' ');
  if (params.intent === 'delete_file' || DESTRUCTIVE_COMMAND_PATTERN.test(normalized)) {
    return {
      riskCode: 'requires_approval_destructive',
      riskReason: '检测到删除或破坏性文件操作，需要人工确认。'
    };
  }
  if (PERMISSION_ESCALATION_PATTERN.test(normalized)) {
    return {
      riskCode: 'requires_approval_permission_escalation',
      riskReason: '检测到权限提升动作，需要人工确认。'
    };
  }
  if (params.intent === 'call_external_api' || EXTERNAL_MUTATION_PATTERN.test(normalized)) {
    return {
      riskCode: 'requires_approval_external_mutation',
      riskReason: '检测到外部变更请求，需要人工确认。'
    };
  }
  if (/connector|policy|governance/i.test(normalized)) {
    return {
      riskCode: 'requires_approval_governance',
      riskReason: '检测到 connector 或治理配置变更，需要人工确认。'
    };
  }
  if (params.riskLevel === 'critical' || params.riskLevel === 'high') {
    return {
      riskCode: 'requires_approval_high_risk',
      riskReason: '当前动作风险较高，需要人工确认。'
    };
  }
  return {
    riskCode: 'requires_approval_governance',
    riskReason: '当前动作会影响运行时环境，需要人工确认。'
  };
}

function buildCommandPreview(preview?: Array<{ label: string; value: string }>) {
  if (!preview?.length) {
    return '';
  }
  const direct = preview.find(item => /command|cmd|shell/i.test(item.label));
  if (direct?.value) {
    return direct.value;
  }
  return preview
    .slice(0, 3)
    .map(item => `${item.label}: ${item.value}`)
    .join(' | ');
}

function mergePreviewItems(
  preview: Array<{ label: string; value: string }> | undefined,
  additions: Array<[label: string, value: string | undefined]>
) {
  const merged = [...(preview ?? [])];
  for (const [label, value] of additions) {
    if (!value) {
      continue;
    }
    if (merged.some(item => item.label === label)) {
      continue;
    }
    merged.push({ label, value });
  }
  return merged;
}
