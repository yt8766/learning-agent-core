import type { ApprovalScopeMatchInput, ApprovalScopePolicyRecord } from '../types/governance.types';

function normalizeApprovalScopeValue(value?: string) {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
}

export function buildApprovalScopeMatchKey(input: ApprovalScopeMatchInput) {
  return [
    normalizeApprovalScopeValue(input.intent),
    normalizeApprovalScopeValue(input.toolName),
    normalizeApprovalScopeValue(input.riskCode),
    normalizeApprovalScopeValue(input.requestedBy),
    normalizeApprovalScopeValue(input.commandPreview)
  ].join('::');
}

export function matchesApprovalScopePolicy(
  policy: Pick<ApprovalScopePolicyRecord, 'status' | 'matchKey'>,
  input: ApprovalScopeMatchInput
) {
  return policy.status === 'active' && policy.matchKey === buildApprovalScopeMatchKey(input);
}
