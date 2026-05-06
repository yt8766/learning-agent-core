import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import Bubble from '@ant-design/x/es/bubble';
import Sender from '@ant-design/x/es/sender';
import Suggestion from '@ant-design/x/es/suggestion';
import { Space, Tag, Typography } from 'antd';
import type { ConversationData } from '@ant-design/x-sdk';

import type { ChatAssistantConfig, ChatMessage, KnowledgeBase, KnowledgeChatStreamState } from '../../types/api';
import { PageSection } from '../shared/ui';
import { ChatLabAssistantPrompts } from './chat-lab-assistant-panel';
import type { KnowledgeBaseMention } from './chat-lab-helpers';
import { removeCurrentKnowledgeMentionToken, uniqueKnowledgeMentions } from './chat-lab-helpers';
import { ChatLabSidebar } from './chat-lab-sidebar';
import { ChatLabStatusLine } from './chat-lab-status-line';

export interface ChatLabConversationData extends ConversationData {
  activeModelProfileId?: string;
  createdAt?: string;
  label: string;
  persisted?: boolean;
  updatedAt?: string;
}

export interface ChatLabLayoutProps {
  activeConversation?: ChatLabConversationData;
  activeConversationKey: string;
  assistantConfig: ChatAssistantConfig | null;
  bubbleMessages: ComponentProps<typeof Bubble.List>['items'];
  chatConversations: ChatLabConversationData[];
  chatLabError: Error | null;
  chatRoles: ComponentProps<typeof Bubble.List>['role'];
  createConversation: (seedMessage?: string) => ChatLabConversationData;
  feedbackMessage: ChatMessage | null;
  isRequesting: boolean;
  knowledgeBaseSuggestionItems: Array<{ label: string; value: string }>;
  knowledgeBases: KnowledgeBase[];
  knowledgeBasesError: Error | null;
  messagesLength: number;
  question: string;
  removeConversation: (conversationId: string) => void;
  renameConversation: (conversationId: string, title: string) => void;
  requestError: Error | null;
  resetConversationRuntime: (key: string) => void;
  selectedMentions: KnowledgeBaseMention[];
  setQuestion: Dispatch<SetStateAction<string>>;
  setSelectedMentions: Dispatch<SetStateAction<KnowledgeBaseMention[]>>;
  streamDiagnostics: ReturnType<typeof import('./chat-lab-diagnostics').summarizeStreamDiagnostics>;
  streamState: KnowledgeChatStreamState;
  submit: (message: string) => void | Promise<void>;
}

export function ChatLabLayout({
  activeConversation,
  activeConversationKey,
  assistantConfig,
  bubbleMessages,
  chatConversations,
  chatLabError,
  chatRoles,
  createConversation,
  feedbackMessage,
  isRequesting,
  knowledgeBaseSuggestionItems,
  knowledgeBases,
  knowledgeBasesError,
  messagesLength,
  question,
  removeConversation,
  renameConversation,
  requestError,
  resetConversationRuntime,
  selectedMentions,
  setQuestion,
  setSelectedMentions,
  streamDiagnostics,
  streamState,
  submit
}: ChatLabLayoutProps) {
  return (
    <PageSection subTitle="临时调参、引用核对、反馈采集和评测样本沉淀" title="检索实验室">
      <div className="knowledge-chat-codex">
        <ChatLabSidebar
          activeConversationKey={activeConversationKey}
          chatConversations={chatConversations}
          createConversation={createConversation}
          knowledgeBases={knowledgeBases}
          removeConversation={removeConversation}
          renameConversation={renameConversation}
          setActiveConversationKey={resetConversationRuntime}
          setSelectedMentions={setSelectedMentions}
        />
        <section className="knowledge-chat-codex-main">
          <div className="knowledge-chat-codex-topbar">
            <Space size={8}>
              <Typography.Text strong>{activeConversation?.label ?? '新对话'}</Typography.Text>
              <Typography.Text type="secondary">检索实验 · route / citation / feedback</Typography.Text>
            </Space>
          </div>

          <div className={messagesLength === 0 ? 'knowledge-chat-empty' : 'knowledge-chat-thread'}>
            {messagesLength === 0 && !isRequesting ? (
              <>
                <Typography.Title className="knowledge-chat-empty-title" level={1}>
                  你好，我是 RAG 检索实验室
                </Typography.Title>
                <Typography.Text className="knowledge-chat-empty-subtitle" type="secondary">
                  {knowledgeBases.length > 0 ? knowledgeBases.map(base => base.name).join(' / ') : 'Knowledge Lab'}
                </Typography.Text>
                <ChatLabAssistantPrompts config={assistantConfig} onPromptSelect={setQuestion} />
              </>
            ) : null}
            {bubbleMessages.length > 0 ? (
              <div className="knowledge-chat-bubbles">
                <Bubble.List items={bubbleMessages} role={chatRoles} />
              </div>
            ) : null}
          </div>

          <div className="knowledge-chat-composer-zone">
            <Suggestion
              block
              items={knowledgeBaseSuggestionItems}
              onSelect={value => {
                const selectedKnowledgeBase = knowledgeBases.find(item => item.id === value);
                if (!selectedKnowledgeBase) {
                  return;
                }
                setSelectedMentions(current =>
                  uniqueKnowledgeMentions([
                    ...current,
                    {
                      id: selectedKnowledgeBase.id,
                      label: selectedKnowledgeBase.name,
                      type: 'knowledge_base'
                    }
                  ])
                );
                setQuestion(current => removeCurrentKnowledgeMentionToken(current));
              }}
            >
              {({ onKeyDown, onTrigger }) => (
                <Sender
                  className="knowledge-chat-sender"
                  header={
                    selectedMentions.length > 0 ? (
                      <div className="knowledge-chat-mention-tags">
                        {selectedMentions.map(mention => (
                          <Tag
                            className="knowledge-chat-mention-tag"
                            closable
                            key={mention.id ?? mention.label}
                            onClose={() =>
                              setSelectedMentions(current =>
                                current.filter(item => (item.id ?? item.label) !== (mention.id ?? mention.label))
                              )
                            }
                          >
                            <span aria-hidden className="knowledge-chat-mention-tag-icon" />
                            {mention.label}
                          </Tag>
                        ))}
                      </div>
                    ) : undefined
                  }
                  loading={isRequesting}
                  onChange={value => {
                    setQuestion(value);
                    onTrigger(/(^|\s)@\S*$/.test(value) ? {} : false);
                  }}
                  onKeyDown={onKeyDown}
                  onSubmit={submit}
                  placeholder="输入问题，或用 @ 选择知识空间"
                  value={question}
                />
              )}
            </Suggestion>
            <ChatLabStatusLine
              chatLabError={chatLabError}
              error={requestError}
              feedbackMessage={feedbackMessage}
              knowledgeBasesError={knowledgeBasesError}
              loading={isRequesting}
              streamDiagnostics={streamDiagnostics}
              streamState={streamState}
            />
          </div>
        </section>
      </div>
    </PageSection>
  );
}
