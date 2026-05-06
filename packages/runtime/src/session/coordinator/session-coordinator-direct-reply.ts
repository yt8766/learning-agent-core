import {
  buildManagerDirectReplySystemPrompt,
  TaskStatus,
  type CapabilityAttachmentRecord,
  type CapabilityAugmentationRecord,
  type ChatMessageRecord,
  type ChatSessionRecord,
  type ChatThoughtChainItem,
  type ILLMProvider,
  type RequestedExecutionHints
} from '@agent/core';

import type { AgentOrchestrator } from '../../orchestration/agent-orchestrator';
import { emitNodeStatusEvent } from '../session-node-events';
import { mergeSystemMessages } from '../../utils/system-messages';
import type { SessionCoordinatorStore } from './session-coordinator-store';
import type { SessionCoordinatorThinking } from './session-coordinator-thinking';
import type { SessionTaskAggregate } from '../session-task.types';
import {
  extractThinkContentFromDirectReplyBuffer,
  sanitizeDirectReplyVisibleContent
} from './direct-reply-stream-helpers';
import {
  runDirectReplyWebSearch,
  shouldSkipDirectReplyWebSearch,
  type DirectReplySearchFn
} from './direct-reply-web-search';
import { buildCheckpointCognitionSnapshot } from './session-coordinator-sync';

type SessionTurnHints = {
  requestedMode?: 'plan' | 'execute' | 'imperial_direct';
  imperialDirectIntent?: {
    enabled: boolean;
    trigger: 'slash-exec' | 'explicit-direct-execution' | 'known-capability';
    requestedCapability?: string;
    reason?: string;
  };
  requestedHints?: RequestedExecutionHints;
  capabilityAttachments?: CapabilityAttachmentRecord[];
  capabilityAugmentations?: CapabilityAugmentationRecord[];
  conversationSummary?: string;
  conversationCompression?: ChatSessionRecord['compression'];
  recentTurns?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  relatedHistory?: string[];
};

export type SessionDirectReplyDeps = {
  orchestrator: AgentOrchestrator;
  store: SessionCoordinatorStore;
  thinking: SessionCoordinatorThinking;
  llmProvider: ILLMProvider;
  syncTask: (sessionId: string, task: SessionTaskAggregate) => void;
  webSearchFn?: DirectReplySearchFn;
};

const DIRECT_REPLY_STREAM_TIMEOUT_MS = 30_000;
const NODE_PROGRESS_THROTTLE_MS = 500;

export function shouldUseSessionDirectReply(message: string, hints?: SessionTurnHints): boolean {
  const raw = message.trim();
  if (!raw) {
    return false;
  }
  if (hints?.requestedMode || hints?.imperialDirectIntent?.enabled) {
    return false;
  }
  if (
    hints?.requestedHints?.preferredMode === 'workflow' ||
    hints?.requestedHints?.preferredMode === 'research-first'
  ) {
    return false;
  }
  if (hints?.requestedHints?.requestedSkill || hints?.requestedHints?.requestedConnectorTemplate) {
    return false;
  }
  if (hints?.capabilityAttachments?.length || hints?.capabilityAugmentations?.length) {
    return false;
  }
  if (/^\/(?!direct-reply\b)[\w-]+/i.test(raw)) {
    return false;
  }
  if (isExecutionOrResearchRequest(raw)) {
    return false;
  }
  return true;
}

export async function runSessionDirectReply(
  deps: SessionDirectReplyDeps,
  sessionId: string,
  input: {
    message: string;
    modelId?: string;
  },
  hints: SessionTurnHints
): Promise<void> {
  const session = deps.store.requireSession(sessionId);
  const llm = deps.llmProvider;
  if (!llm?.isConfigured?.()) {
    const task = await deps.orchestrator.createTask({
      goal: input.message,
      context: await deps.thinking.buildConversationContext(
        session,
        deps.store.getCheckpoint(sessionId),
        deps.store.getMessages(sessionId),
        input.message
      ),
      constraints: [],
      sessionId,
      ...hints
    });
    deps.syncTask(sessionId, task);
    await deps.store.persistRuntimeState();
    return;
  }

  const startedAt = new Date().toISOString();
  const checkpoint =
    deps.store.getCheckpoint(sessionId) ?? deps.store.createCheckpoint(sessionId, `direct-reply:${sessionId}`);
  const directReplyTaskStub = { id: checkpoint.taskId };

  checkpoint.chatRoute = {
    graph: 'workflow',
    flow: 'direct-reply',
    reason: 'session_fast_path_general_prompt',
    adapter: 'general-prompt',
    priority: 80,
    intent: 'direct-reply',
    intentConfidence: 0.9,
    executionReadiness: 'ready',
    matchedSignals: ['session-fast-path'],
    preferredExecutionMode: 'direct-reply'
  };
  checkpoint.graphState = {
    ...checkpoint.graphState,
    status: TaskStatus.RUNNING,
    currentStep: 'direct_reply'
  };
  checkpoint.currentNode = 'direct_reply';
  checkpoint.updatedAt = startedAt;

  const assistantMessageId = `direct_reply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const assistantCreatedAt = new Date().toISOString();

  checkpoint.thinkState = {
    title: '直接回复',
    content: '正在组织推理与正文…',
    messageId: assistantMessageId,
    loading: true,
    blink: true
  };

  deps.store.checkpoints.set(sessionId, checkpoint);

  emitNodeStatusEvent(deps.store, sessionId, {
    task: directReplyTaskStub,
    checkpoint,
    nodeId: 'direct_reply',
    phase: 'start',
    detail: '正在生成回复'
  });
  await deps.store.persistRuntimeState();

  checkpoint.thoughtChain = [buildDirectReplyIntentItem(input.message, assistantMessageId)];
  deps.store.checkpoints.set(sessionId, checkpoint);

  let webSearchContext = '';
  if (deps.webSearchFn && !shouldSkipDirectReplyWebSearch(input.message)) {
    emitNodeStatusEvent(deps.store, sessionId, {
      task: directReplyTaskStub,
      checkpoint,
      nodeId: 'web_search',
      phase: 'start',
      detail: '正在搜索网页'
    });

    const searchOutput = await runDirectReplyWebSearch({
      query: input.message,
      searchFn: deps.webSearchFn,
      taskId: checkpoint.taskId
    });

    if (searchOutput.sources.length) {
      const hits = sourcesToThoughtHits(searchOutput.sources);
      const chainKey = Date.now();
      checkpoint.externalSources = [...(checkpoint.externalSources ?? []), ...searchOutput.sources];
      checkpoint.thoughtChain = [
        ...(checkpoint.thoughtChain ?? []),
        {
          key: `web_search_${chainKey}`,
          messageId: assistantMessageId,
          kind: 'web_search',
          title: '搜索网页',
          description: `搜索到 ${searchOutput.sources.length} 个网页`,
          status: 'success',
          webSearch: {
            query: input.message,
            resultCount: searchOutput.sources.length,
            topHosts: searchOutput.topHosts,
            hitIds: searchOutput.sources.map(s => s.id),
            hits
          }
        },
        {
          key: `retrieval_eval_${chainKey}`,
          messageId: assistantMessageId,
          kind: 'reasoning',
          title: '检索评估',
          description: '检索结果与问题相关，已抽取页面标题与摘要，用于综合回答。',
          status: 'success',
          collapsible: false
        },
        {
          key: `browser_${chainKey}`,
          messageId: assistantMessageId,
          kind: 'browser',
          title: '浏览页面',
          description: `结合 ${searchOutput.sources.length} 个页面的公开摘要展开推理。`,
          status: 'success',
          browser: {
            pageCount: searchOutput.sources.length,
            pages: hits
          },
          collapsible: false
        }
      ];
      webSearchContext = searchOutput.contextSnippet;
      deps.store.checkpoints.set(sessionId, checkpoint);
    } else {
      checkpoint.thoughtChain = [
        ...(checkpoint.thoughtChain ?? []),
        {
          key: `web_search_empty_${Date.now()}`,
          messageId: assistantMessageId,
          kind: 'reasoning',
          title: '联网检索',
          description: '已完成检索，暂未匹配到强相关网页摘要，将更多依赖模型内建知识作答。',
          status: 'success',
          collapsible: false
        }
      ];
      deps.store.checkpoints.set(sessionId, checkpoint);
    }

    emitNodeStatusEvent(deps.store, sessionId, {
      task: directReplyTaskStub,
      checkpoint,
      nodeId: 'web_search',
      phase: 'end',
      detail: searchOutput.sources.length ? `搜索到 ${searchOutput.sources.length} 个网页` : '未找到相关网页'
    });
    await deps.store.persistRuntimeState();
  }

  let streamedMessage: ChatMessageRecord | undefined;
  let tokenCount = 0;
  let lastProgressEmitMs = 0;
  let streamResult: string | undefined;

  try {
    streamResult = await withTimeout(
      llm.streamText(
        buildDirectReplyMessages(input.message, hints, input.modelId, webSearchContext),
        {
          role: 'manager',
          modelId: input.modelId ?? hints.requestedHints?.preferredModelId,
          temperature: 0.2,
          maxTokens: 4096
        },
        token => {
          tokenCount += 1;
          streamedMessage = deps.store.appendStreamingMessage(
            sessionId,
            assistantMessageId,
            token,
            'manager',
            assistantCreatedAt
          );
          deps.store.addEvent(sessionId, 'assistant_token', {
            messageId: assistantMessageId,
            content: token,
            route: 'direct-reply'
          });

          const raw = streamedMessage.content;
          const thinkDraft = extractThinkContentFromDirectReplyBuffer(raw);
          checkpoint.thinkState = {
            title: '直接回复',
            content: thinkDraft || checkpoint.thinkState?.content || '正在组织推理与正文…',
            messageId: assistantMessageId,
            loading: true,
            blink: true
          };
          deps.store.checkpoints.set(sessionId, checkpoint);

          const nowMs = Date.now();
          if (nowMs - lastProgressEmitMs >= NODE_PROGRESS_THROTTLE_MS) {
            lastProgressEmitMs = nowMs;
            emitNodeStatusEvent(deps.store, sessionId, {
              task: directReplyTaskStub,
              checkpoint,
              nodeId: 'direct_reply',
              phase: 'progress',
              detail: `流式生成中（约 ${tokenCount} token）`,
              progressPercent: Math.min(99, 12 + Math.floor(tokenCount / 25))
            });
          }
        }
      ),
      DIRECT_REPLY_STREAM_TIMEOUT_MS
    );
  } catch (error) {
    const failedAt = new Date().toISOString();
    checkpoint.graphState = {
      ...checkpoint.graphState,
      status: TaskStatus.FAILED,
      currentStep: 'direct_reply'
    };
    checkpoint.streamStatus = undefined;
    checkpoint.thinkState = {
      title: '直接回复',
      content: error instanceof Error ? error.message : '本轮回复未能完成。',
      messageId: assistantMessageId,
      loading: false,
      blink: false
    };
    checkpoint.updatedAt = failedAt;
    deps.store.checkpoints.set(sessionId, checkpoint);
    const failedSnapshot = buildCheckpointCognitionSnapshot(checkpoint);
    if (failedSnapshot) {
      deps.store.mergeAssistantCognitionSnapshot(sessionId, assistantMessageId, failedSnapshot);
    }
    await deps.store.persistRuntimeState();
    throw error instanceof Error ? error : new Error(String(error));
  }

  const rawFinal = streamedMessage?.content || streamResult || '';
  const thinkSummary = extractThinkContentFromDirectReplyBuffer(rawFinal);
  const finalContent = sanitizeDirectReplyVisibleContent(rawFinal);
  if (streamedMessage && finalContent) {
    streamedMessage.content = finalContent;
  }
  const assistantMessage =
    streamedMessage && finalContent
      ? streamedMessage
      : deps.store.addMessage(sessionId, 'assistant', finalContent || '我暂时没有生成有效回复。', 'manager');
  if (streamedMessage && streamedMessage.content !== assistantMessage.content) {
    streamedMessage.content = assistantMessage.content;
  }

  const completedAt = new Date().toISOString();
  const durationMs = Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());

  session.status = 'completed';
  session.updatedAt = completedAt;
  checkpoint.graphState = {
    ...checkpoint.graphState,
    status: TaskStatus.COMPLETED,
    currentStep: 'direct_reply'
  };
  checkpoint.currentNode = 'direct_reply';

  emitNodeStatusEvent(deps.store, sessionId, {
    task: directReplyTaskStub,
    checkpoint,
    nodeId: 'direct_reply',
    phase: 'end',
    detail: '已完成',
    progressPercent: 100
  });
  checkpoint.streamStatus = undefined;

  checkpoint.thinkState = {
    title: '直接回复',
    content: thinkSummary || '已基于通用对话模型生成回复。',
    messageId: assistantMessageId,
    thinkingDurationMs: durationMs,
    loading: false,
    blink: false
  };
  const planDesc = buildDirectReplyPlanDescription(thinkSummary || '');
  if (planDesc) {
    checkpoint.thoughtChain = [
      ...(checkpoint.thoughtChain ?? []),
      {
        key: `direct_reply_plan_${assistantMessageId}`,
        messageId: assistantMessageId,
        kind: 'reasoning',
        title: '组织回答',
        description: planDesc,
        status: 'success',
        collapsible: false
      }
    ];
  }
  checkpoint.updatedAt = completedAt;
  deps.store.checkpoints.set(sessionId, checkpoint);

  const cognitionSnapshot = buildCheckpointCognitionSnapshot(checkpoint);
  if (cognitionSnapshot) {
    deps.store.mergeAssistantCognitionSnapshot(sessionId, assistantMessage.id, cognitionSnapshot);
  }

  deps.store.addEvent(sessionId, 'assistant_message', {
    messageId: assistantMessage.id,
    content: assistantMessage.content,
    summary: assistantMessage.content,
    route: 'direct-reply',
    tokenCount
  });
  deps.store.addEvent(sessionId, 'final_response_completed', {
    messageId: assistantMessage.id,
    content: assistantMessage.content,
    route: 'direct-reply',
    taskId: checkpoint.taskId
  });
  await deps.store.persistRuntimeState();
}

function buildDirectReplyIntentItem(message: string, messageId: string): ChatThoughtChainItem {
  const t = message.trim().replace(/\s+/g, ' ');
  const preview = !t ? '' : t.length > 220 ? `${t.slice(0, 220)}…` : t;
  const description = !t
    ? '已收到提问，将梳理意图并组织回答。'
    : `先对齐问题边界：${preview}。随后根据需要检索资料并整理结论。`;

  return {
    key: `direct_reply_intent_${messageId}`,
    messageId,
    kind: 'reasoning',
    title: '理解问题',
    description,
    status: 'success',
    collapsible: false
  };
}

function sourcesToThoughtHits(sources: Array<{ sourceUrl: string; summary: string }>) {
  return sources.map(s => {
    let host = '';
    try {
      host = new URL(s.sourceUrl).hostname;
    } catch {
      /* ignore malformed URL */
    }
    return {
      url: s.sourceUrl,
      title: s.summary || host || '网页',
      host
    };
  });
}

function buildDirectReplyPlanDescription(thinkSummary: string): string {
  const t = thinkSummary.trim().replace(/\s+/g, ' ');
  if (!t) {
    return '';
  }
  if (t.length <= 420) {
    return t;
  }
  return `${t.slice(0, 420)}…`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('direct reply stream timed out')), timeoutMs);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function buildDirectReplyMessages(
  message: string,
  hints: SessionTurnHints,
  modelId?: string,
  webSearchContext?: string
) {
  const recentTurns = (hints.recentTurns ?? [])
    .slice(-6)
    .map(turn => `${turn.role}: ${turn.content}`)
    .join('\n');
  const context = [hints.conversationSummary ? `会话摘要：${hints.conversationSummary}` : '', recentTurns]
    .filter(Boolean)
    .join('\n\n');

  return mergeSystemMessages([
    {
      role: 'system' as const,
      content: buildManagerDirectReplySystemPrompt({ modelId })
    },
    ...(context
      ? [
          {
            role: 'system' as const,
            content: `可用的近期对话上下文如下，仅在相关时使用：\n${context}`
          }
        ]
      : []),
    ...(webSearchContext
      ? [
          {
            role: 'system' as const,
            content: `以下是针对用户问题的网络搜索结果，请在回答中引用相关来源（使用 Markdown 链接格式）：\n${webSearchContext}`
          }
        ]
      : []),
    {
      role: 'user' as const,
      content: message
    }
  ]);
}

function isExecutionOrResearchRequest(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    /^(\/(?:browse|review|qa|ship|plan|plan-ceo-review|plan-eng-review|exec)\b)/i.test(normalized) ||
    /(实现|修改|修复|改一下|重构|新增|加一个|优化|删除|迁移|接入|联调|运行|测试|发布|提交|创建分支|开\s*pr|审批|安装|连接器|生成报表|生成页面|写文件|改代码|查资料|调研|检索|搜索|联网|最新|今天|现在|实时|新闻)/i.test(
      normalized.replace(/现在(?=.{0,24}(是什么|是啥|介绍|能做什么|会做什么))/g, '')
    ) ||
    /\b(implement|modify|change|fix|refactor|add|delete|migrate|run|test|build|deploy|release|commit|pull request|install|connector|browse|research|search|latest|today|realtime)\b/i.test(
      normalized
    )
  );
}
