import { http } from '@/utils/http-client';
import type { PatchUserProfileDto } from '@agent/core';

export type ChatMemoryFeedbackKind = 'adopted' | 'dismissed' | 'corrected';

export async function recordChatMemoryFeedback(memoryId: string, kind: ChatMemoryFeedbackKind) {
  const response = await http.post(`/memory/${encodeURIComponent(memoryId)}/feedback`, { kind });
  return response.data;
}

export async function overrideChatMemory(
  memoryId: string,
  params: {
    summary: string;
    content: string;
    tags?: string[];
    reason: string;
    actor?: string;
    memoryType?:
      | 'fact'
      | 'preference'
      | 'constraint'
      | 'procedure'
      | 'reflection'
      | 'summary'
      | 'skill-experience'
      | 'failure-pattern';
    scopeType?: 'session' | 'user' | 'task' | 'workspace' | 'team' | 'org' | 'global';
  }
) {
  const response = await http.post(`/memory/${encodeURIComponent(memoryId)}/override`, {
    ...params,
    actor: params.actor ?? 'agent-chat-user'
  });
  return response.data;
}

export async function patchChatProfile(userId: string, patch: PatchUserProfileDto) {
  const response = await http.patch(`/profiles/${encodeURIComponent(userId)}`, {
    ...patch,
    actor: patch.actor ?? 'agent-chat-user'
  });
  return response.data;
}
