import type { MenuProps } from 'antd';

import { buildSubmitMessage, stripLeadingWorkflowCommand } from './chat-home-submit';
import { resolveSuggestedDraftSubmission, type QuickActionChip } from './chat-home-workbench-support';

export type ChatMode = 'quick' | 'expert';

export interface ChatComposerState {
  draft: string;
  suggestedPayload: string | null;
  planModeEnabled: boolean;
}

export function buildQuickActionMenuItems(quickActionChips: QuickActionChip[]) {
  return quickActionChips.map(item => ({
    key: item.label,
    icon: item.icon,
    label: item.label
  })) satisfies MenuProps['items'];
}

export function resolveQuickActionSelection(
  quickActionChips: QuickActionChip[],
  key: string
): ChatComposerState | null {
  const matched = quickActionChips.find(item => item.label === key);
  if (!matched) {
    return null;
  }

  return {
    draft: stripLeadingWorkflowCommand(matched.value),
    suggestedPayload: matched.value,
    planModeEnabled: false
  };
}

export function resetComposerState(): ChatComposerState {
  return {
    draft: '',
    suggestedPayload: null,
    planModeEnabled: false
  };
}

export function resolveComposerChange(nextDraft: string, currentPlanModeEnabled: boolean): ChatComposerState {
  return {
    draft: nextDraft,
    suggestedPayload: null,
    planModeEnabled: currentPlanModeEnabled
  };
}

export function resolveComposerPlanModeChange(checked: boolean, draft: string): ChatComposerState {
  return {
    draft,
    suggestedPayload: null,
    planModeEnabled: checked
  };
}

export function resolveComposerSubmit(value: string, suggestedPayload: string | null, planModeEnabled: boolean) {
  return suggestedPayload && !planModeEnabled
    ? resolveSuggestedDraftSubmission(value, suggestedPayload)
    : buildSubmitMessage(value, planModeEnabled ? ['plan'] : []);
}

export function resolveComposerSubmitForMode(value: string, suggestedPayload: string | null, chatMode: ChatMode) {
  if (suggestedPayload) {
    return resolveComposerSubmit(value, suggestedPayload, false);
  }

  return resolveComposerSubmit(value, null, chatMode === 'expert');
}
