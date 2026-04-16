import { Button, Space, Tag, Typography } from 'antd';
import { useState } from 'react';

import {
  overrideChatMemory,
  patchChatProfile,
  recordChatMemoryFeedback,
  type ChatMemoryFeedbackKind
} from '@/api/chat-memory-api';
import type { ChatCheckpointRecord } from '@/types/chat';
import {
  buildForgetMemoryOverridePayload,
  buildSessionMemoryOverridePayload,
  buildSessionOnlyMemoryOverridePayload
} from './chat-memory-feedback-helpers';
import { buildProfilePatchFromPreferenceUpdate } from './chat-memory-preference-helpers';

const { Text } = Typography;

type MemoryEvidenceRecord = NonNullable<ChatCheckpointRecord['externalSources']>[number];

interface ChatMemoryFeedbackStripProps {
  sources: MemoryEvidenceRecord[];
  onUpdated?: () => Promise<void> | void;
}

export function ChatMemoryFeedbackStrip(props: ChatMemoryFeedbackStripProps) {
  const actionableSources = props.sources
    .map(source => ({
      source,
      memoryId: typeof source.detail?.memoryId === 'string' ? source.detail.memoryId : undefined
    }))
    .filter((item): item is { source: MemoryEvidenceRecord; memoryId: string } => Boolean(item.memoryId))
    .slice(0, 2);
  const [pendingKey, setPendingKey] = useState('');
  const [recorded, setRecorded] = useState<Record<string, ChatMemoryFeedbackKind>>({});

  if (!actionableSources.length) {
    return null;
  }

  async function handleRecord(memoryId: string, kind: ChatMemoryFeedbackKind) {
    const key = `${memoryId}:${kind}`;
    setPendingKey(key);
    try {
      await recordChatMemoryFeedback(memoryId, kind);
      setRecorded(current => ({ ...current, [memoryId]: kind }));
    } finally {
      setPendingKey('');
    }
  }

  async function handleCorrection(source: MemoryEvidenceRecord, memoryId: string) {
    const suggestion = window.prompt('请用一句话告诉我这条记忆应该改成什么。', '');
    if (!suggestion?.trim()) {
      return;
    }

    const payload = buildSessionMemoryOverridePayload(source, suggestion);
    const key = `${memoryId}:override`;
    setPendingKey(key);
    try {
      await overrideChatMemory(memoryId, payload);
      await recordChatMemoryFeedback(memoryId, 'corrected');
      setRecorded(current => ({ ...current, [memoryId]: 'corrected' }));
      await props.onUpdated?.();
    } finally {
      setPendingKey('');
    }
  }

  async function handleSessionOnly(source: MemoryEvidenceRecord, memoryId: string) {
    const key = `${memoryId}:session-only`;
    setPendingKey(key);
    try {
      await overrideChatMemory(memoryId, buildSessionOnlyMemoryOverridePayload(source));
      await recordChatMemoryFeedback(memoryId, 'adopted');
      setRecorded(current => ({ ...current, [memoryId]: 'adopted' }));
      await props.onUpdated?.();
    } finally {
      setPendingKey('');
    }
  }

  async function handleForget(source: MemoryEvidenceRecord, memoryId: string) {
    const key = `${memoryId}:forget`;
    setPendingKey(key);
    try {
      await overrideChatMemory(memoryId, buildForgetMemoryOverridePayload(source));
      await recordChatMemoryFeedback(memoryId, 'dismissed');
      setRecorded(current => ({ ...current, [memoryId]: 'dismissed' }));
      await props.onUpdated?.();
    } finally {
      setPendingKey('');
    }
  }

  async function handleUpdatePreference(source: MemoryEvidenceRecord, memoryId: string) {
    const profileUserId = extractProfileUserId(source);
    if (!profileUserId) {
      return;
    }

    const suggestion = window.prompt(
      '请输入新的偏好。可直接输入内容；若需要指定字段，可用 “communicationStyle: 先给结论” 这样的格式。',
      ''
    );
    if (!suggestion?.trim()) {
      return;
    }

    const patch = buildProfilePatchFromPreferenceUpdate(source, suggestion);
    if (!patch) {
      window.alert('暂时无法自动识别这条偏好对应的画像字段，请使用 “字段: 内容” 格式重试。');
      return;
    }

    const key = `${memoryId}:profile-patch`;
    setPendingKey(key);
    try {
      await patchChatProfile(profileUserId, patch);
      await recordChatMemoryFeedback(memoryId, 'corrected');
      setRecorded(current => ({ ...current, [memoryId]: 'corrected' }));
      await props.onUpdated?.();
    } finally {
      setPendingKey('');
    }
  }

  return (
    <div className="chatx-mission-card__meta">
      {actionableSources.map(({ source, memoryId }) => (
        <div key={source.id} style={{ display: 'grid', gap: 6 }}>
          <Space size={[6, 6]} wrap>
            <Tag color="gold">memory</Tag>
            <Text type="secondary">{source.summary.replace(/^已命中历史记忆：/, '').slice(0, 24)}</Text>
          </Space>
          {getMemoryReasonCopy(source) ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              采用原因：{getMemoryReasonCopy(source)}
            </Text>
          ) : null}
          <Space size={[6, 6]} wrap>
            {source.detail?.memoryType === 'preference' && extractProfileUserId(source) ? (
              <Button
                size="small"
                type={pendingKey === `${memoryId}:profile-patch` ? 'primary' : 'default'}
                loading={pendingKey === `${memoryId}:profile-patch`}
                onClick={() => void handleUpdatePreference(source, memoryId)}
              >
                Update preference
              </Button>
            ) : null}
            <Button
              size="small"
              type={recorded[memoryId] === 'adopted' ? 'primary' : 'default'}
              loading={pendingKey === `${memoryId}:adopted`}
              onClick={() => void handleRecord(memoryId, 'adopted')}
            >
              有用
            </Button>
            <Button
              size="small"
              type={recorded[memoryId] === 'dismissed' ? 'primary' : 'default'}
              loading={pendingKey === `${memoryId}:dismissed`}
              onClick={() => void handleRecord(memoryId, 'dismissed')}
            >
              不适用
            </Button>
            <Button
              size="small"
              type={
                recorded[memoryId] === 'dismissed' && pendingKey !== `${memoryId}:dismissed` ? 'primary' : 'default'
              }
              loading={pendingKey === `${memoryId}:forget`}
              onClick={() => void handleForget(source, memoryId)}
            >
              Forget this
            </Button>
            <Button
              size="small"
              danger
              type={recorded[memoryId] === 'corrected' ? 'primary' : 'default'}
              loading={pendingKey === `${memoryId}:override`}
              onClick={() => void handleCorrection(source, memoryId)}
            >
              记错了
            </Button>
            <Button
              size="small"
              type={pendingKey === `${memoryId}:session-only` ? 'primary' : 'default'}
              loading={pendingKey === `${memoryId}:session-only`}
              onClick={() => void handleSessionOnly(source, memoryId)}
            >
              仅本会话
            </Button>
          </Space>
        </div>
      ))}
    </div>
  );
}

function getMemoryReasonCopy(source: MemoryEvidenceRecord) {
  const reason = typeof source.detail?.reason === 'string' ? source.detail.reason : '';
  const score = typeof source.detail?.score === 'number' ? source.detail.score : undefined;
  if (!reason && typeof score !== 'number') {
    return '';
  }
  if (!reason) {
    return `score ${score?.toFixed(2)}`;
  }
  return typeof score === 'number' ? `${reason} · score ${score.toFixed(2)}` : reason;
}

function extractProfileUserId(source: MemoryEvidenceRecord) {
  if (!Array.isArray(source.detail?.relatedEntities)) {
    return '';
  }
  const matched = source.detail.relatedEntities.find(item => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    return (
      typeof (item as { entityType?: unknown }).entityType === 'string' &&
      (item as { entityType: string }).entityType === 'user' &&
      typeof (item as { entityId?: unknown }).entityId === 'string'
    );
  }) as { entityId?: string } | undefined;
  return matched?.entityId ?? '';
}
