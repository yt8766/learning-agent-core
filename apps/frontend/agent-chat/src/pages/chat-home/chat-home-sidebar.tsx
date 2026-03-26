import { Button, Input, Modal, Segmented, Space, Tag, Typography, Avatar } from 'antd';
import { Conversations } from '@ant-design/x';
import type { ChangeEvent } from 'react';
import type { ConversationItemType } from '@ant-design/x';

import type { useChatSession } from '../../hooks/use-chat-session';
import { formatSessionTime, getSessionStatusLabel } from '../../hooks/use-chat-session';
import { FILTER_OPTIONS, type SessionFilter } from './chat-home-constants';
import {
  ArchiveGlyph,
  DeleteGlyph,
  getConversationGroup,
  getSessionBadgeStatus,
  getStatusPill,
  matchesFilter,
  RenameGlyph,
  ShareGlyph
} from './chat-home-helpers';

const { Search } = Input;
const { Text, Title } = Typography;

export function buildConversationItems(
  sessions: ReturnType<typeof useChatSession>['sessions'],
  searchKeyword: string,
  sessionFilter: SessionFilter
): ConversationItemType[] {
  const keyword = searchKeyword.trim().toLowerCase();

  return sessions
    .filter(
      session =>
        (!keyword || session.title.toLowerCase().includes(keyword)) && matchesFilter(session.status, sessionFilter)
    )
    .map(session => {
      const badgeStatus = getSessionBadgeStatus(session.status);
      const shouldPulse = session.status === 'running' || session.status === 'waiting_approval';

      return {
        key: session.id,
        group: getConversationGroup(session.status),
        title: session.title,
        label: (
          <div className={`conversation-item ${shouldPulse ? 'is-live' : ''}`}>
            <div className="conversation-item__header">
              <Text strong ellipsis>
                {session.title}
              </Text>
              <Space size={6}>
                <span className={`conversation-item__dot ${badgeStatus}`} />
                <Tag
                  color={
                    badgeStatus === 'processing'
                      ? 'blue'
                      : badgeStatus === 'warning'
                        ? 'orange'
                        : badgeStatus === 'error'
                          ? 'red'
                          : badgeStatus === 'success'
                            ? 'green'
                            : 'default'
                  }
                >
                  {getStatusPill(session.status)}
                </Tag>
              </Space>
            </div>
            <Text type="secondary" className="conversation-item__meta">
              {getSessionStatusLabel(session.status)} · {formatSessionTime(session.updatedAt)}
            </Text>
          </div>
        ),
        'data-session-id': session.id
      };
    });
}

interface ChatHomeSidebarProps {
  chat: ReturnType<typeof useChatSession>;
  searchKeyword: string;
  sessionFilter: SessionFilter;
  onSearchKeywordChange: (value: string) => void;
  onSessionFilterChange: (value: SessionFilter) => void;
}

export function ChatHomeSidebar(props: ChatHomeSidebarProps) {
  const conversationItems = buildConversationItems(props.chat.sessions, props.searchKeyword, props.sessionFilter);

  return (
    <>
      <div className="chatx-brand">
        <Avatar size={46} className="chatx-brand__avatar">
          AI
        </Avatar>
        <div className="chatx-brand__copy">
          <Title level={4}>AI Chat</Title>
        </div>
      </div>

      <Button
        type="primary"
        size="large"
        htmlType="button"
        block
        style={{ width: '280px' }}
        className="chatx-new-chat"
        onClick={() => props.chat.createNewSession()}
      >
        开始新对话
      </Button>

      <Search
        allowClear
        placeholder="搜索会话"
        value={props.searchKeyword}
        onChange={(event: ChangeEvent<HTMLInputElement>) => props.onSearchKeywordChange(event.target.value)}
        className="chatx-search"
      />

      <Segmented
        block
        size="small"
        options={FILTER_OPTIONS}
        value={props.sessionFilter}
        onChange={value => props.onSessionFilterChange(value as SessionFilter)}
        className="chatx-filter"
      />

      <Conversations
        items={conversationItems}
        activeKey={props.chat.activeSessionId}
        onActiveChange={value => props.chat.setActiveSessionId(String(value))}
        menu={conversation =>
          conversation.key
            ? {
                className: 'chatx-conversation-menu',
                items: [
                  {
                    key: 'rename',
                    label: (
                      <span className="chatx-conversation-menu__item">
                        <RenameGlyph />
                        <span>重命名</span>
                      </span>
                    )
                  },
                  {
                    key: 'share',
                    label: (
                      <span className="chatx-conversation-menu__item">
                        <ShareGlyph />
                        <span>复制链接</span>
                      </span>
                    )
                  },
                  { type: 'divider' },
                  {
                    key: 'archive',
                    disabled: true,
                    label: (
                      <span className="chatx-conversation-menu__item is-disabled">
                        <ArchiveGlyph />
                        <span>归档</span>
                      </span>
                    )
                  },
                  {
                    key: 'delete',
                    danger: true,
                    label: (
                      <span className="chatx-conversation-menu__item is-danger">
                        <DeleteGlyph />
                        <span>删除对话</span>
                      </span>
                    )
                  }
                ],
                onClick: ({ key }) => {
                  if (key === 'rename') {
                    let nextTitle = String(conversation.title ?? '');
                    Modal.confirm({
                      title: '重命名会话',
                      content: (
                        <Input
                          autoFocus
                          defaultValue={nextTitle}
                          maxLength={80}
                          onChange={event => {
                            nextTitle = event.target.value;
                          }}
                        />
                      ),
                      okText: '保存',
                      cancelText: '取消',
                      onOk: async () => props.chat.renameSessionById(String(conversation.key), nextTitle)
                    });
                    return;
                  }
                  if (key === 'share') {
                    const shareUrl = `${window.location.origin}${window.location.pathname}?sessionId=${encodeURIComponent(String(conversation.key))}`;
                    void navigator.clipboard.writeText(shareUrl);
                    return;
                  }
                  if (key === 'delete') {
                    Modal.confirm({
                      title: '删除当前会话？',
                      content: '删除后，这个会话的聊天记录、事件流和检查点都会一起移除。',
                      okText: '删除',
                      okButtonProps: { danger: true },
                      cancelText: '取消',
                      onOk: async () => props.chat.deleteSessionById(String(conversation.key))
                    });
                  }
                },
                trigger: (_conversation, info) => (
                  <span className="chatx-conversation-menu-trigger" aria-label="会话操作">
                    {info.originNode}
                  </span>
                )
              }
            : undefined
        }
        className="chatx-conversations"
        groupable={{ label: group => <span className="chatx-group-label">{group}</span> }}
      />
    </>
  );
}
