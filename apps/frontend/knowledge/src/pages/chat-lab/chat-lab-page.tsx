import { useEffect, useMemo, useState } from 'react';
import { Bubble, Sender, Suggestion } from '@ant-design/x';
import { useXChat, useXConversations, type ConversationData } from '@ant-design/x-sdk';
import { Space, Tag, Typography } from 'antd';

import { useKnowledgeApi } from '../../api/knowledge-api-provider';
import { createKnowledgeChatActions } from '../../chat-runtime/knowledge-chat-actions';
import {
  createKnowledgeChatProvider,
  type KnowledgeChatProviderChunk,
  type KnowledgeChatProviderInput
} from '../../chat-runtime/knowledge-chat-provider';
import { useChatAssistantConfig } from '../../hooks/use-knowledge-governance';
import type { ChatMessage, CreateFeedbackRequest, KnowledgeBase, KnowledgeChatStreamState } from '../../types/api';
import { PageSection } from '../shared/ui';
import { ChatLabAssistantPrompts, ChatLabThinkingPreview } from './chat-lab-assistant-panel';
import { loadKnowledgeConversationMessages, summarizeStreamDiagnostics, toError } from './chat-lab-diagnostics';
import {
  createChatLabConversation,
  deriveConversationTitle,
  parseKnowledgeMentions,
  removeCurrentKnowledgeMentionToken,
  uniqueKnowledgeMentions,
  type KnowledgeBaseMention
} from './chat-lab-helpers';
import { createChatRoles, type FeedbackValue } from './chat-lab-messages';
import { ChatLabSidebar } from './chat-lab-sidebar';
import { ChatLabStatusLine } from './chat-lab-status-line';

export { resolveChatLabKnowledgeBaseId } from './chat-lab-helpers';

interface ChatLabConversationData extends ConversationData {
  activeModelProfileId?: string;
  createdAt?: string;
  label: string;
  persisted?: boolean;
  updatedAt?: string;
}

const initialStreamState: KnowledgeChatStreamState = {
  answerText: '',
  citations: [],
  events: [],
  phase: 'idle'
};

export function ChatLabPage() {
  const api = useKnowledgeApi();
  const actions = useMemo(() => createKnowledgeChatActions({ api }), [api]);
  const initialConversationItems = useMemo<ChatLabConversationData[]>(() => {
    const initialConversation = createChatLabConversation('');
    return [
      {
        createdAt: initialConversation.createdAt,
        key: initialConversation.id,
        label: initialConversation.title,
        persisted: false,
        updatedAt: initialConversation.updatedAt
      }
    ];
  }, []);
  const {
    addConversation,
    conversations,
    getConversation,
    getMessages,
    removeConversation: removeConversationState,
    setActiveConversationKey,
    setConversation,
    setConversations,
    activeConversationKey
  } = useXConversations({
    defaultActiveConversationKey: initialConversationItems[0]?.key,
    defaultConversations: initialConversationItems
  });
  const [question, setQuestion] = useState('');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [knowledgeBasesError, setKnowledgeBasesError] = useState<Error | null>(null);
  const [chatLabError, setChatLabError] = useState<Error | null>(null);
  const [requestError, setRequestError] = useState<Error | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<ChatMessage | null>(null);
  const [selectedModelProfileId, setSelectedModelProfileId] = useState('knowledge-rag');
  const [messageFeedback, setMessageFeedback] = useState<Record<string, FeedbackValue>>({});
  const [selectedMentions, setSelectedMentions] = useState<KnowledgeBaseMention[]>([]);
  const [deepThink, setDeepThink] = useState(true);
  const [webSearch, setWebSearch] = useState(false);
  const [streamState, setStreamState] = useState<KnowledgeChatStreamState>(initialStreamState);
  const { config: assistantConfig } = useChatAssistantConfig();
  const provider = useMemo(
    () =>
      createKnowledgeChatProvider({
        api,
        onStreamStateChange(nextStreamState) {
          setStreamState(nextStreamState);
        }
      }),
    [api]
  );
  const { isRequesting, messages, onRequest, queueRequest } = useXChat<
    ChatMessage,
    ChatMessage,
    KnowledgeChatProviderInput,
    KnowledgeChatProviderChunk
  >({
    conversationKey: String(activeConversationKey),
    defaultMessages: async ({ conversationKey }: { conversationKey?: string }) => {
      const currentConversation = conversationKey
        ? (getConversation(String(conversationKey)) as ChatLabConversationData)
        : undefined;
      if (!currentConversation?.persisted) {
        return [];
      }
      return loadKnowledgeConversationMessages(api, String(conversationKey)).then(result =>
        result.map(message => ({ id: message.id, message, status: 'success' as const }))
      );
    },
    provider,
    requestFallback: (requestParams, info) => {
      const nextError = toError(info.error);
      setRequestError(nextError);
      return {
        content: nextError.message,
        conversationId: requestParams.conversationId ?? String(activeConversationKey),
        createdAt: new Date().toISOString(),
        id: info.messageInfo.message.id,
        role: 'assistant'
      } satisfies ChatMessage;
    },
    requestPlaceholder: requestParams => ({
      content: '',
      conversationId: requestParams.conversationId ?? String(activeConversationKey),
      createdAt: new Date().toISOString(),
      id: `loading_assistant_${Date.now()}`,
      role: 'assistant'
    })
  });
  const activeConversation =
    (getConversation(String(activeConversationKey)) as ChatLabConversationData | undefined) ??
    (conversations[0] as ChatLabConversationData | undefined);
  const knowledgeBaseSuggestionItems = useMemo(
    () => knowledgeBases.map(item => ({ label: item.name, value: item.id })),
    [knowledgeBases]
  );
  const streamDiagnostics = useMemo(() => summarizeStreamDiagnostics(streamState.events), [streamState.events]);
  const bubbleMessages = useMemo(
    () =>
      messages.map(({ message, status }) => {
        if (message.role === 'assistant') {
          return {
            content: message.content,
            extraInfo: {
              citations: message.citations ?? [],
              diagnostics: message.diagnostics,
              feedback: messageFeedback[message.id],
              messageId: message.id,
              route: message.route,
              traceId: message.traceId
            },
            key: message.id,
            role: 'ai',
            status: status === 'error' || status === 'abort' ? 'success' : status
          } as const;
        }
        return {
          content: message.content,
          key: message.id,
          role: message.role === 'system' ? 'system' : 'user'
        } as const;
      }),
    [messageFeedback, messages]
  );

  useEffect(() => {
    let mounted = true;
    setKnowledgeBasesError(null);
    void Promise.all([api.listKnowledgeBases(), api.listRagModelProfiles(), actions.listConversations()])
      .then(([knowledgeBaseResult, , conversationItems]) => {
        if (!mounted) {
          return;
        }
        setKnowledgeBases(knowledgeBaseResult.items);
        if (conversationItems.length === 0) {
          return;
        }
        const restoredConversations = conversationItems.map(item => ({
          ...item,
          activeModelProfileId: item.group,
          persisted: true
        })) as ChatLabConversationData[];
        setConversations(restoredConversations);
        setActiveConversationKey(restoredConversations[0]!.key);
        setSelectedModelProfileId(restoredConversations[0]!.activeModelProfileId ?? 'knowledge-rag');
      })
      .catch(error => {
        if (!mounted) {
          return;
        }
        const nextError = toError(error);
        setKnowledgeBasesError(nextError);
        setChatLabError(nextError);
      });
    return () => {
      mounted = false;
    };
  }, [actions, api, setActiveConversationKey, setConversations]);

  useEffect(() => {
    if (!assistantConfig) {
      return;
    }
    setDeepThink(assistantConfig.deepThinkEnabled);
    setWebSearch(assistantConfig.webSearchEnabled);
    setSelectedModelProfileId(assistantConfig.modelProfileId);
  }, [assistantConfig]);

  useEffect(() => {
    if (!activeConversation?.activeModelProfileId) {
      return;
    }
    setSelectedModelProfileId(activeConversation.activeModelProfileId);
  }, [activeConversation?.activeModelProfileId]);

  const chatRoles = useMemo(
    () =>
      createChatRoles({
        setMessageFeedback,
        submitFeedback: async (messageId: string, input: CreateFeedbackRequest) => {
          const nextFeedbackMessage = await actions.createFeedback(messageId, input);
          if (nextFeedbackMessage) {
            setFeedbackMessage(nextFeedbackMessage);
          }
          return nextFeedbackMessage;
        }
      }),
    [actions]
  );

  function createConversation(seedMessage?: string) {
    const nextConversation = createChatLabConversation(seedMessage);
    const nextItem: ChatLabConversationData = {
      createdAt: nextConversation.createdAt,
      key: nextConversation.id,
      label: nextConversation.title,
      persisted: false,
      updatedAt: nextConversation.updatedAt
    };
    addConversation(nextItem, 'prepend');
    setActiveConversationKey(nextItem.key);
    return nextItem;
  }

  function renameConversation(conversationId: string, title: string) {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return;
    }
    const currentConversation = getConversation(conversationId) as ChatLabConversationData | undefined;
    if (!currentConversation) {
      return;
    }
    setConversation(conversationId, {
      ...currentConversation,
      label: normalizedTitle,
      updatedAt: new Date().toISOString()
    });
  }

  function removeConversation(conversationId: string) {
    const didRemove = removeConversationState(conversationId);
    if (!didRemove || conversations.length > 1) {
      return;
    }
    const fallbackConversation = createConversation('');
    setActiveConversationKey(fallbackConversation.key);
  }

  async function submit(message: string) {
    const normalizedMessage = message.trim();
    if (!normalizedMessage && selectedMentions.length === 0) {
      return;
    }

    setRequestError(null);
    setChatLabError(null);
    setStreamState(initialStreamState);

    const conversationId = String(activeConversationKey);
    const currentConversation = activeConversation ?? createConversation(normalizedMessage);
    const availableKnowledgeBases = knowledgeBases.length > 0 ? knowledgeBases : (await api.listKnowledgeBases()).items;
    if (knowledgeBases.length === 0) {
      setKnowledgeBases(availableKnowledgeBases);
    }
    const mentions = uniqueKnowledgeMentions([
      ...selectedMentions,
      ...parseKnowledgeMentions(message, availableKnowledgeBases)
    ]);
    const currentMessages = (getMessages(conversationId) as Array<{ message: ChatMessage }> | undefined) ?? [];
    if (currentMessages.length === 0) {
      setConversation(conversationId, {
        ...currentConversation,
        label: deriveConversationTitle(normalizedMessage),
        updatedAt: new Date().toISOString()
      });
    }
    setQuestion('');
    setSelectedMentions([]);

    const requestParams: KnowledgeChatProviderInput = {
      conversationId,
      messages: [{ content: normalizedMessage, role: 'user' }],
      metadata: {
        conversationId,
        debug: true,
        mentions,
        reasoningMode: deepThink ? 'deep' : 'standard',
        webSearchMode: webSearch ? 'allowed' : 'off'
      },
      model: selectedModelProfileId,
      stream: true
    };

    if (currentConversation.key !== conversationId) {
      queueRequest(conversationId, requestParams);
      return;
    }

    onRequest(requestParams);
  }

  return (
    <PageSection title="对话实验室">
      <div className="knowledge-chat-codex">
        <ChatLabSidebar
          activeConversationKey={String(activeConversationKey)}
          chatConversations={conversations as ChatLabConversationData[]}
          createConversation={createConversation}
          knowledgeBases={knowledgeBases}
          removeConversation={removeConversation}
          renameConversation={renameConversation}
          setActiveConversationKey={key => {
            setActiveConversationKey(key);
            setRequestError(null);
            setChatLabError(null);
            setStreamState(initialStreamState);
          }}
          setSelectedMentions={setSelectedMentions}
        />
        <section className="knowledge-chat-codex-main">
          <div className="knowledge-chat-codex-topbar">
            <Space size={8}>
              <Typography.Text strong>{activeConversation?.label ?? '新对话'}</Typography.Text>
              <Typography.Text type="secondary">knowledge</Typography.Text>
            </Space>
          </div>

          <div className={messages.length === 0 ? 'knowledge-chat-empty' : 'knowledge-chat-thread'}>
            {messages.length === 0 && !isRequesting ? (
              <>
                <Typography.Title className="knowledge-chat-empty-title" level={1}>
                  你好，我是 Knowledge
                </Typography.Title>
                <Typography.Text className="knowledge-chat-empty-subtitle" type="secondary">
                  {knowledgeBases.length > 0 ? knowledgeBases.map(base => base.name).join(' / ') : 'Knowledge Lab'}
                </Typography.Text>
                <ChatLabAssistantPrompts config={assistantConfig} onPromptSelect={setQuestion} />
                <ChatLabThinkingPreview config={assistantConfig} />
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
                  placeholder="要求后续变更"
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
