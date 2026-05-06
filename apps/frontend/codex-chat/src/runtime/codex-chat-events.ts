import type { ChatEventRecord } from '../types/chat';
import { readPayloadText, readString, type UiMessage } from './codex-chat-message';
import { splitReasoning } from '../utils/parse-reasoning';

export const streamTerminalEvents = new Set([
  'final_response_completed',
  'assistant_message',
  'session_finished',
  'session_failed'
]);

const approvalEvents = new Set(['approval_required', 'interrupt_pending', 'execution_step_blocked']);

export function isStreamTerminalEvent(type: string) {
  return streamTerminalEvents.has(type);
}

function titleFromStepPayload(payload: Record<string, unknown>, fallback: string) {
  return (
    readString(payload.title) ??
    readString(payload.label) ??
    readString(payload.nodeLabel) ??
    readString(payload.stage) ??
    fallback
  );
}

function normalizeStepTitle(event: ChatEventRecord) {
  const payload = event.payload ?? {};
  const detail = readString(payload.summary) ?? readString(payload.detail) ?? readString(payload.intent);
  const raw = titleFromStepPayload(payload, event.type);
  const fallback: Record<string, string> = {
    node_progress: '推进任务',
    execution_step_started: '开始执行',
    execution_step_completed: '完成步骤',
    tool_called: '准备工具',
    tool_selected: '选择能力',
    assistant_message: '生成回答',
    final_response_completed: '交付输出'
  };

  if (detail) {
    return detail;
  }

  if (raw && raw !== event.type && raw !== 'node_progress') {
    return raw;
  }

  return fallback[event.type] ?? '分析上下文';
}

function normalizeStepDescription(event: ChatEventRecord) {
  const payload = event.payload ?? {};
  return readString(payload.description) ?? readString(payload.stage) ?? readString(payload.reason);
}

function approvalText(event: ChatEventRecord) {
  const payload = event.payload ?? {};
  const action =
    readString(payload.toolName) ?? readString(payload.intent) ?? readString(payload.requestId) ?? '这个操作';
  const reason =
    readString(payload.reason) ?? readString(payload.reasonCode) ?? '技能、规则、插件治理与发布类动作默认需要人工审批';

  return `执行已暂停：${action} 需要人工审批。${reason}。\n\n回复“执行”继续，或回复“取消”放弃。`;
}

function updateAssistantDraft(messages: UiMessage[], event: ChatEventRecord): UiMessage[] {
  const payload = event.payload ?? {};
  const messageId = readString(payload.messageId) ?? readString(payload.id) ?? `assistant-${event.sessionId}`;
  const existingIndex = messages.findIndex(item => item.id === messageId);
  const isDelta = event.type === 'assistant_token' || event.type === 'final_response_delta';
  const nextText = readPayloadText(payload);

  if (!nextText && event.type !== 'assistant_message' && event.type !== 'final_response_completed') {
    return messages;
  }

  const current =
    existingIndex >= 0
      ? messages[existingIndex]
      : {
          id: messageId,
          status: 'loading' as const,
          message: { role: 'assistant' as const, content: '', steps: [] }
        };

  const rawContent = isDelta ? `${current.message.content}${nextText}` : nextText || current.message.content;
  const parts = splitReasoning(rawContent);
  const next: UiMessage = {
    ...current,
    status: isStreamTerminalEvent(event.type) ? 'success' : 'updating',
    message: {
      ...current.message,
      content: parts.visibleContent,
      reasoning: parts.reasoning ?? current.message.reasoning,
      thinkingDurationMs:
        isStreamTerminalEvent(event.type) &&
        current.message.thinkingDurationMs &&
        current.message.thinkingDurationMs > 1000000000000
          ? Date.now() - current.message.thinkingDurationMs
          : current.message.thinkingDurationMs
    }
  };

  if (existingIndex < 0) {
    return [...messages, next];
  }

  return messages.map((item, index) => (index === existingIndex ? next : item));
}

function updateAssistantSteps(messages: UiMessage[], event: ChatEventRecord): UiMessage[] {
  const payload = event.payload ?? {};
  const lastAssistantIndex = messages.findLastIndex(item => item.message.role === 'assistant');

  if (lastAssistantIndex < 0) {
    return messages;
  }

  const step = {
    id: readString(payload.sourceEventId) ?? event.id,
    title: normalizeStepTitle(event),
    description: normalizeStepDescription(event),
    status: event.type.includes('completed') ? ('completed' as const) : ('running' as const),
    agentLabel: readString(payload.agentLabel) ?? readString(payload.ownerLabel)
  };

  return messages.map((item, index) => {
    if (index !== lastAssistantIndex) {
      return item;
    }

    const steps = item.message.steps ?? [];
    const stepIndex = steps.findIndex(currentStep => currentStep.id === step.id);
    const nextSteps =
      stepIndex < 0 ? [...steps, step] : steps.map((currentStep, i) => (i === stepIndex ? step : currentStep));

    return {
      ...item,
      message: {
        ...item.message,
        steps: nextSteps
      }
    };
  });
}

function appendApprovalMessage(messages: UiMessage[], event: ChatEventRecord): UiMessage[] {
  const messageId = `approval-${readString(event.payload?.interruptId) ?? readString(event.payload?.approvalId) ?? event.id}`;
  const approvalMessage: UiMessage = {
    id: messageId,
    status: 'success',
    message: {
      role: 'assistant',
      content: approvalText(event),
      approvalPending: true,
      reasoning: '我先把需要确认的动作停在对话里，等你明确回复后再继续执行。',
      steps: [
        { id: `${messageId}-risk`, title: '识别需要审批的动作', status: 'completed' },
        { id: `${messageId}-wait`, title: '等待你的确认', status: 'blocked' }
      ]
    }
  };
  const existingIndex = messages.findIndex(item => item.id === messageId);

  if (existingIndex < 0) {
    return [...messages, approvalMessage];
  }

  return messages.map((item, index) => (index === existingIndex ? approvalMessage : item));
}

export function syncEvent(messages: UiMessage[], event: ChatEventRecord): UiMessage[] {
  if (approvalEvents.has(event.type)) {
    return appendApprovalMessage(updateAssistantSteps(messages, event), event);
  }

  if (
    event.type === 'assistant_token' ||
    event.type === 'assistant_message' ||
    event.type === 'final_response_delta' ||
    event.type === 'final_response_completed'
  ) {
    return updateAssistantDraft(messages, event);
  }

  if (
    event.type === 'node_progress' ||
    event.type === 'execution_step_started' ||
    event.type === 'execution_step_completed' ||
    event.type === 'tool_called' ||
    event.type === 'tool_selected'
  ) {
    return updateAssistantSteps(messages, event);
  }

  return messages;
}
