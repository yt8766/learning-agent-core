import { useEffect, useMemo, useRef, useState } from 'react';
import Actions from '@ant-design/x/es/actions';
import XMarkdown from '@ant-design/x-markdown/es';
import Bubble, { type BubbleItemType, type BubbleListProps } from '@ant-design/x/es/bubble';
import Conversations from '@ant-design/x/es/conversations';
import Sender from '@ant-design/x/es/sender';
import Suggestion from '@ant-design/x/es/suggestion';
import { Button, Flex, Select, Space, Spin, Tag, Typography } from 'antd';

import { useKnowledgeApi } from '../../api/knowledge-api-provider';
import { useKnowledgeChat } from '../../hooks/use-knowledge-chat';
import type { ChatConversation, ChatMessage, Citation, KnowledgeBase, RagModelProfileSummary } from '../../types/api';
import { PageSection } from '../shared/ui';
import {
  createChatLabConversation,
  deriveConversationTitle,
  parseKnowledgeMentions,
  removeCurrentKnowledgeMentionToken,
  uniqueKnowledgeMentions,
  type KnowledgeBaseMention,
  type ChatLabConversation
} from './chat-lab-helpers';

type FeedbackValue = 'default' | 'like' | 'dislike';

interface ChatLabAiExtraInfo {
  citations: Citation[];
  diagnostics?: ChatMessage['diagnostics'];
  feedback?: FeedbackValue;
  messageId: string;
  route?: ChatMessage['route'];
  traceId?: string;
}

export function resolveChatLabKnowledgeBaseId(knowledgeBases: readonly Pick<KnowledgeBase, 'id'>[]) {
  return knowledgeBases[0]?.id;
}

function formatCitationScore(score: number | undefined) {
  return typeof score === 'number' ? score.toFixed(2) : undefined;
}

function CitationList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) {
    return <Typography.Text type="secondary">引用来源：无</Typography.Text>;
  }

  return (
    <div className="knowledge-chat-citations">
      <Typography.Text strong>引用来源</Typography.Text>
      {citations.map(citation => {
        const score = formatCitationScore(citation.score);
        return (
          <div className="knowledge-chat-citation" key={citation.id}>
            <Space direction="vertical" size={4}>
              <Typography.Text strong>{citation.title}</Typography.Text>
              <Typography.Text>{citation.quote}</Typography.Text>
              <Space wrap>
                {score ? <Tag>score {score}</Tag> : null}
                {citation.uri ? <Typography.Text type="secondary">{citation.uri}</Typography.Text> : null}
              </Space>
            </Space>
          </div>
        );
      })}
    </div>
  );
}

export function ChatLabPage() {
  const api = useKnowledgeApi();
  const conversationMessagesRequestIdRef = useRef(0);
  const [question, setQuestion] = useState('');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [knowledgeBasesError, setKnowledgeBasesError] = useState<Error | null>(null);
  const [modelProfiles, setModelProfiles] = useState<RagModelProfileSummary[]>([]);
  const [chatLabError, setChatLabError] = useState<Error | null>(null);
  const [selectedModelProfileId, setSelectedModelProfileId] = useState('knowledge-rag');
  const [messageFeedback, setMessageFeedback] = useState<Record<string, FeedbackValue>>({});
  const [selectedMentions, setSelectedMentions] = useState<KnowledgeBaseMention[]>([]);
  const [chatConversations, setChatConversations] = useState<ChatLabConversation[]>(() => [
    createChatLabConversation('')
  ]);
  const [activeConversationKey, setActiveConversationKey] = useState(() => chatConversations[0]!.id);
  const { error, feedbackMessage, loading, sendMessage, streamState, submitFeedback } = useKnowledgeChat();
  const activeConversation = chatConversations.find(item => item.id === activeConversationKey) ?? chatConversations[0]!;
  const conversationItems = useMemo(
    () => chatConversations.map(item => ({ key: item.id, label: item.title })),
    [chatConversations]
  );
  const knowledgeBaseSuggestionItems = useMemo(
    () => knowledgeBases.map(item => ({ label: item.name, value: item.id })),
    [knowledgeBases]
  );
  const modelProfileOptions = useMemo(
    () => [
      { label: 'SDK RAG', value: 'knowledge-rag' },
      ...modelProfiles.filter(profile => profile.enabled).map(profile => ({ label: profile.label, value: profile.id }))
    ],
    [modelProfiles]
  );
  const streamDiagnostics = useMemo(() => summarizeStreamDiagnostics(streamState.events), [streamState.events]);

  useEffect(() => {
    let mounted = true;
    setKnowledgeBasesError(null);
    void Promise.all([api.listKnowledgeBases(), api.listRagModelProfiles(), api.listConversations()])
      .then(async ([knowledgeBaseResult, modelProfileResult, conversationResult]) => {
        if (!mounted) {
          return;
        }
        setKnowledgeBases(knowledgeBaseResult.items);
        setModelProfiles(modelProfileResult.items);
        const backendConversations = conversationResult.items.map(toChatLabConversation);
        if (backendConversations.length === 0) {
          return;
        }
        const activeConversation = backendConversations[0]!;
        setChatConversations(backendConversations);
        setActiveConversationKey(activeConversation.id);
        setSelectedModelProfileId(activeConversation.activeModelProfileId ?? 'knowledge-rag');
      })
      .catch(error => {
        if (mounted) {
          const nextError = toError(error);
          setKnowledgeBasesError(nextError);
          setChatLabError(nextError);
        }
      });
    return () => {
      mounted = false;
    };
  }, [api]);

  useEffect(() => {
    const active = chatConversations.find(item => item.id === activeConversationKey);
    if (!active?.activeModelProfileId) {
      return;
    }
    setSelectedModelProfileId(active.activeModelProfileId);
  }, [activeConversationKey, chatConversations]);

  useEffect(() => {
    const active = chatConversations.find(item => item.id === activeConversationKey);
    if (!active?.persisted) {
      return;
    }
    const requestId = conversationMessagesRequestIdRef.current + 1;
    conversationMessagesRequestIdRef.current = requestId;
    let mounted = true;
    void api
      .listConversationMessages(active.id)
      .then(result => {
        if (!mounted || requestId !== conversationMessagesRequestIdRef.current) {
          return;
        }
        setChatConversations(current =>
          current.map(conversation =>
            conversation.id === active.id
              ? {
                  ...conversation,
                  messages: mergeChatMessages(result.items, conversation.messages)
                }
              : conversation
          )
        );
      })
      .catch(error => {
        if (mounted && requestId === conversationMessagesRequestIdRef.current) {
          setChatLabError(toError(error));
        }
      });
    return () => {
      mounted = false;
    };
  }, [activeConversationKey, api]);

  const chatRoles = useMemo(
    () =>
      ({
        ai: {
          contentRender: (content: unknown) => <XMarkdown>{String(content ?? '')}</XMarkdown>,
          footer: (content: unknown, { extraInfo, key }: { extraInfo?: unknown; key?: string | number }) => {
            const info = extraInfo as ChatLabAiExtraInfo | undefined;
            if (!info?.messageId) {
              return null;
            }
            const text = String(content ?? '');
            return (
              <Space direction="vertical" size={8}>
                <Actions
                  items={[
                    {
                      key: 'copy',
                      label: 'copy',
                      actionRender: () => <Actions.Copy text={text} />
                    },
                    {
                      key: 'feedback',
                      actionRender: () => (
                        <Actions.Feedback
                          key="feedback"
                          onChange={value => {
                            const nextFeedback = value as FeedbackValue;
                            setMessageFeedback(current => ({ ...current, [String(key)]: nextFeedback }));
                            if (nextFeedback === 'like') {
                              void submitFeedback(info.messageId, { category: 'helpful', rating: 'positive' });
                            }
                            if (nextFeedback === 'dislike') {
                              void submitFeedback(info.messageId, { category: 'not_helpful', rating: 'negative' });
                            }
                          }}
                          styles={{
                            liked: {
                              color: '#f759ab'
                            }
                          }}
                          value={info.feedback ?? 'default'}
                        />
                      )
                    }
                  ]}
                />
                <Space wrap>
                  {info.route ? <Tag>{info.route.reason}</Tag> : null}
                  {info.diagnostics ? (
                    <Typography.Text type="secondary">{info.diagnostics.retrievalMode}</Typography.Text>
                  ) : null}
                  {info.traceId ? (
                    <Typography.Link href={`/observability?traceId=${info.traceId}`}>
                      Trace {info.traceId}
                    </Typography.Link>
                  ) : null}
                  <CitationList citations={info.citations} />
                </Space>
              </Space>
            );
          },
          loadingRender: () => (
            <Flex align="center" gap="small">
              <Spin size="small" />
              <Typography.Text type="secondary">正在检索知识库...</Typography.Text>
            </Flex>
          ),
          placement: 'start' as const,
          typing: (_content: unknown, { status }: { status?: string }) =>
            status === 'updating' ? { effect: 'typing' as const, interval: 20, step: 5 } : false,
          variant: 'borderless' as const
        },
        system: { placement: 'start' as const, variant: 'outlined' as const },
        user: { placement: 'end' as const, variant: 'filled' as const }
      }) satisfies NonNullable<BubbleListProps['role']>,
    [submitFeedback]
  );

  const messages: BubbleItemType[] = [
    ...activeConversation.messages.map(message => toBubbleMessage(message, messageFeedback)),
    loading
      ? {
          content: streamState.answerText,
          key: 'answer-loading',
          loading: streamState.answerText.length === 0,
          role: 'ai',
          status: streamState.answerText.length > 0 ? 'updating' : 'loading'
        }
      : null
  ].filter(Boolean) as BubbleItemType[];

  function createConversation(seedMessage?: string) {
    const nextConversation = createChatLabConversation(seedMessage);
    setChatConversations(current => [nextConversation, ...current]);
    setActiveConversationKey(nextConversation.id);
    return nextConversation;
  }

  async function submit(message: string) {
    const normalizedMessage = message.trim();
    if (!normalizedMessage && selectedMentions.length === 0) {
      return;
    }
    const now = new Date().toISOString();
    const conversationId = activeConversationKey;
    const availableKnowledgeBases = knowledgeBases.length > 0 ? knowledgeBases : (await api.listKnowledgeBases()).items;
    if (knowledgeBases.length === 0) {
      setKnowledgeBases(availableKnowledgeBases);
    }
    const mentions = uniqueKnowledgeMentions([
      ...selectedMentions,
      ...parseKnowledgeMentions(message, availableKnowledgeBases)
    ]);
    const userMessage: ChatMessage = {
      id: `local_user_${Date.now()}`,
      conversationId,
      role: 'user',
      content: normalizedMessage,
      createdAt: now
    };
    setChatConversations(current =>
      current.map(conversation =>
        conversation.id === conversationId
          ? {
              ...conversation,
              title:
                conversation.messages.length === 0 ? deriveConversationTitle(normalizedMessage) : conversation.title,
              messages: [...conversation.messages, userMessage],
              updatedAt: now
            }
          : conversation
      )
    );
    setQuestion('');
    setSelectedMentions([]);
    const nextResponse = await sendMessage({
      messages: [{ content: normalizedMessage, role: 'user' }],
      metadata: {
        conversationId,
        debug: true,
        mentions
      },
      model: selectedModelProfileId,
      stream: true
    });
    if (!nextResponse) {
      return;
    }
    setChatConversations(current =>
      current.map(conversation =>
        conversation.id === conversationId
          ? {
              ...conversation,
              messages: [
                ...conversation.messages,
                {
                  ...nextResponse.assistantMessage,
                  citations: nextResponse.citations,
                  content: nextResponse.answer,
                  diagnostics: nextResponse.diagnostics,
                  route: nextResponse.route,
                  traceId: nextResponse.traceId
                }
              ],
              updatedAt: new Date().toISOString()
            }
          : conversation
      )
    );
  }

  return (
    <PageSection title="对话实验室">
      <div className="knowledge-chat-codex">
        <aside className="knowledge-chat-codex-sidebar">
          <div className="knowledge-chat-sidebar-actions">
            <Button
              icon={<span aria-hidden className="knowledge-chat-icon is-plus" />}
              onClick={() => createConversation()}
              type="text"
            >
              新建会话
            </Button>
            <Button icon={<span aria-hidden className="knowledge-chat-icon is-search" />} type="text">
              搜索
            </Button>
          </div>
          <div className="knowledge-chat-sidebar-block">
            <div className="knowledge-chat-sidebar-title">对话</div>
            <Conversations
              activeKey={activeConversationKey}
              items={conversationItems}
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
        <section className="knowledge-chat-codex-main">
          <div className="knowledge-chat-codex-topbar">
            <Space size={8}>
              <Typography.Text strong>{activeConversation.title}</Typography.Text>
              <Typography.Text type="secondary">knowledge</Typography.Text>
            </Space>
            <Space className="knowledge-chat-run-meta" size={8}>
              <span aria-hidden className="knowledge-chat-icon is-branch" />
              <Select
                options={modelProfileOptions}
                onChange={setSelectedModelProfileId}
                size="small"
                value={selectedModelProfileId}
              />
            </Space>
          </div>

          <div className={activeConversation.messages.length === 0 ? 'knowledge-chat-empty' : 'knowledge-chat-thread'}>
            {activeConversation.messages.length === 0 && !loading ? (
              <>
                <Typography.Title className="knowledge-chat-empty-title" level={1}>
                  我们该构建什么？
                </Typography.Title>
                <Typography.Text className="knowledge-chat-empty-subtitle" type="secondary">
                  {knowledgeBases.length > 0 ? knowledgeBases.map(base => base.name).join(' / ') : 'Knowledge Lab'}
                </Typography.Text>
              </>
            ) : null}
            {messages.length > 0 ? (
              <div className="knowledge-chat-bubbles">
                <Bubble.List items={messages} role={chatRoles} />
              </div>
            ) : null}
          </div>

          <div className="knowledge-chat-composer-zone">
            <Suggestion
              block
              items={knowledgeBaseSuggestionItems}
              onSelect={value => {
                const selectedKnowledgeBase = knowledgeBases.find(item => item.id === value);
                if (selectedKnowledgeBase) {
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
                }
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
                  loading={loading}
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
            <div className="knowledge-chat-status-line">
              {error ? <Typography.Text type="danger">{error.message}</Typography.Text> : null}
              {knowledgeBasesError ? (
                <Typography.Text type="danger">{knowledgeBasesError.message}</Typography.Text>
              ) : null}
              {chatLabError && chatLabError !== knowledgeBasesError ? (
                <Typography.Text type="danger">{chatLabError.message}</Typography.Text>
              ) : null}
              {feedbackMessage ? <Typography.Text type="success">反馈已记录</Typography.Text> : null}
              {loading && streamState.phase !== 'idle' ? (
                <Typography.Text type="secondary">
                  {formatStreamPhase(streamState.phase)} · {streamState.events.length} events
                </Typography.Text>
              ) : null}
              {streamDiagnostics ? (
                <Space wrap>
                  {streamDiagnostics.planner ? <Tag>{streamDiagnostics.planner}</Tag> : null}
                  {streamDiagnostics.selectionReason ? (
                    <Typography.Text>{streamDiagnostics.selectionReason}</Typography.Text>
                  ) : null}
                  {streamDiagnostics.confidence ? <Tag>{streamDiagnostics.confidence}</Tag> : null}
                  {streamDiagnostics.searchMode ? <Tag>{streamDiagnostics.searchMode}</Tag> : null}
                  {streamDiagnostics.retrievalMode ? <Tag>{streamDiagnostics.retrievalMode}</Tag> : null}
                  {typeof streamDiagnostics.finalHitCount === 'number' ? (
                    <Tag>{streamDiagnostics.finalHitCount} hits</Tag>
                  ) : null}
                  {streamDiagnostics.executedQuery ? (
                    <Typography.Text>{streamDiagnostics.executedQuery}</Typography.Text>
                  ) : null}
                </Space>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </PageSection>
  );
}

function formatStreamPhase(phase: ReturnType<typeof useKnowledgeChat>['streamState']['phase']) {
  if (phase === 'planner') {
    return '正在选库';
  }
  if (phase === 'retrieval') {
    return '正在检索';
  }
  if (phase === 'answer') {
    return '正在生成';
  }
  if (phase === 'completed') {
    return '已完成';
  }
  if (phase === 'error') {
    return '生成失败';
  }
  return '准备中';
}

function toChatLabConversation(conversation: ChatConversation): ChatLabConversation {
  return {
    id: conversation.id,
    title: conversation.title,
    activeModelProfileId: conversation.activeModelProfileId,
    persisted: true,
    messages: [],
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  };
}

function mergeChatMessages(
  backendMessages: readonly ChatMessage[],
  currentMessages: readonly ChatMessage[]
): ChatMessage[] {
  const merged = new Map<string, ChatMessage>();
  for (const message of backendMessages) {
    merged.set(message.id, message);
  }
  for (const message of currentMessages) {
    merged.set(message.id, message);
  }
  return [...merged.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function summarizeStreamDiagnostics(events: ReturnType<typeof useKnowledgeChat>['streamState']['events']) {
  const plannerEvent = [...events].reverse().find(event => event.type === 'planner.completed');
  const retrievalEvent = [...events].reverse().find(event => event.type === 'retrieval.completed');
  const plan = plannerEvent?.type === 'planner.completed' ? plannerEvent.plan : undefined;
  const retrieval = retrievalEvent?.type === 'retrieval.completed' ? retrievalEvent.retrieval : undefined;
  const diagnostics = toDiagnosticRecord(retrieval?.diagnostics);
  const executedQuery = toExecutedQuery(diagnostics.executedQueries);
  const finalHitCount =
    typeof diagnostics.finalHitCount === 'number' ? diagnostics.finalHitCount : retrieval?.hits.length;
  const hasRetrievalDiagnostics = Object.keys(diagnostics).length > 0;
  if (!plan && !hasRetrievalDiagnostics && typeof finalHitCount !== 'number') {
    return undefined;
  }
  return {
    planner: plan?.diagnostics.planner,
    selectionReason: plan?.selectionReason,
    confidence: typeof plan?.confidence === 'number' ? plan.confidence.toFixed(2) : undefined,
    searchMode: plan?.searchMode,
    retrievalMode: typeof diagnostics.effectiveSearchMode === 'string' ? diagnostics.effectiveSearchMode : undefined,
    finalHitCount,
    executedQuery: executedQuery
      ? `${executedQuery.query} · ${executedQuery.mode} · ${executedQuery.hitCount}`
      : undefined
  };
}

function toDiagnosticRecord(diagnostics: unknown): Record<string, unknown> {
  return typeof diagnostics === 'object' && diagnostics !== null ? (diagnostics as Record<string, unknown>) : {};
}

function toExecutedQuery(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const first = value[0];
  if (typeof first === 'string') {
    return { query: first, mode: 'query', hitCount: 0 };
  }
  if (typeof first !== 'object' || first === null) {
    return undefined;
  }
  const record = first as Record<string, unknown>;
  if (typeof record.query !== 'string') {
    return undefined;
  }
  return {
    query: record.query,
    mode: typeof record.mode === 'string' ? record.mode : 'query',
    hitCount: typeof record.hitCount === 'number' ? record.hitCount : 0
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function toBubbleMessage(message: ChatMessage, feedback: Record<string, FeedbackValue>): BubbleItemType {
  if (message.role === 'assistant') {
    return {
      content: message.content,
      extraInfo: {
        citations: message.citations ?? [],
        diagnostics: message.diagnostics,
        feedback: feedback[message.id],
        messageId: message.id,
        route: message.route,
        traceId: message.traceId
      } satisfies ChatLabAiExtraInfo,
      key: message.id,
      role: 'ai',
      status: 'success'
    };
  }
  return {
    content: message.content,
    key: message.id,
    role: message.role === 'system' ? 'system' : 'user'
  };
}
