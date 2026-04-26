interface SubmitActionChip {
  label: string;
  value: string;
}

const WORKFLOW_COMMAND_PATTERN = /^\/(?:browse|review|qa|ship|plan-ceo-review|plan-eng-review|plan)\b\s*/i;
const EXPLICIT_WORKFLOW_PATTERN = /^\/(?:browse|review|qa|ship|plan-ceo-review|plan-eng-review|plan)\b/i;
const DEFAULT_PLAN_WORKFLOW_COMMAND = '/plan';

export function stripLeadingWorkflowCommand(value: string) {
  return value.replace(WORKFLOW_COMMAND_PATTERN, '').trim();
}

export function buildSubmitMessage(
  value: string,
  activeModes: string[] = [],
  _primaryQuickActionChips: SubmitActionChip[] = []
): { display: string; payload: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      display: '',
      payload: ''
    };
  }

  if (EXPLICIT_WORKFLOW_PATTERN.test(trimmed)) {
    const normalizedInput = stripLeadingWorkflowCommand(trimmed);
    return {
      display: normalizedInput || trimmed,
      payload: trimmed
    };
  }

  if (activeModes.includes('plan')) {
    return {
      display: trimmed,
      payload: `${DEFAULT_PLAN_WORKFLOW_COMMAND} ${trimmed}`
    };
  }

  return {
    display: trimmed,
    payload: trimmed
  };
}
