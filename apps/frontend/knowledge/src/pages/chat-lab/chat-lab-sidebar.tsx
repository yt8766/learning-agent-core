import { Conversations } from '@ant-design/x';
import { Button } from 'antd';
import type { Dispatch, SetStateAction } from 'react';

import type { KnowledgeBase } from '../../types/api';
import { uniqueKnowledgeMentions, type KnowledgeBaseMention } from './chat-lab-helpers';

interface ChatLabSidebarConversation {
  key: string;
  label: string;
}

export function ChatLabSidebar({
  activeConversationKey,
  chatConversations,
  createConversation,
  knowledgeBases,
  removeConversation,
  renameConversation,
  setActiveConversationKey,
  setSelectedMentions
}: {
  activeConversationKey: string;
  chatConversations: ChatLabSidebarConversation[];
  createConversation(seedMessage?: string): ChatLabSidebarConversation;
  knowledgeBases: KnowledgeBase[];
  removeConversation: (conversationId: string) => void;
  renameConversation: (conversationId: string, title: string) => void;
  setActiveConversationKey: (key: string) => void;
  setSelectedMentions: Dispatch<SetStateAction<KnowledgeBaseMention[]>>;
}) {
  return (
    <aside className="knowledge-chat-codex-sidebar">
      <div className="knowledge-chat-sidebar-actions">
        <Button
          icon={<span aria-hidden className="knowledge-chat-icon is-plus" />}
          onClick={() => createConversation()}
          type="text"
        >
          新会话
        </Button>
      </div>
      <div className="knowledge-chat-sidebar-block">
        <div className="knowledge-chat-sidebar-title">对话</div>
        <Conversations
          activeKey={activeConversationKey}
          items={chatConversations}
          menu={conversation => ({
            items: [
              { key: 'rename', label: '重命名' },
              { danger: true, key: 'delete', label: '删除' }
            ],
            onClick: info => {
              info.domEvent.stopPropagation();
              if (info.key === 'rename') {
                const nextTitle = window.prompt('重命名会话', String(conversation.label ?? ''))?.trim();
                if (nextTitle) {
                  renameConversation(String(conversation.key), nextTitle);
                }
                return;
              }
              if (info.key === 'delete') {
                removeConversation(String(conversation.key));
              }
            }
          })}
          onActiveChange={setActiveConversationKey}
        />
      </div>
      <div className="knowledge-chat-sidebar-block">
        <div className="knowledge-chat-sidebar-title">知识库</div>
        <div className="knowledge-chat-base-list">
          {knowledgeBases.map(base => (
            <button
              className="knowledge-chat-base-item"
              key={base.id}
              onClick={() =>
                setSelectedMentions(current =>
                  uniqueKnowledgeMentions([
                    ...current,
                    {
                      id: base.id,
                      label: base.name,
                      type: 'knowledge_base'
                    }
                  ])
                )
              }
              type="button"
            >
              <span aria-hidden className="knowledge-chat-icon is-folder" />
              <span>{base.name}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
