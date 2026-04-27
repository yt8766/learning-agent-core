import {
  TaskStatus,
  type CapabilityAttachmentRecord,
  type CapabilityAugmentationRecord,
  type ChatMessageRecord,
  type ChatSessionRecord,
  type ILLMProvider,
  type RequestedExecutionHints
} from '@agent/core';

import type { AgentOrchestrator } from '../orchestration/agent-orchestrator';
import type { SessionCoordinatorStore } from './session-coordinator-store';
import type { SessionCoordinatorThinking } from './session-coordinator-thinking';
import type { SessionTaskAggregate } from './session-task.types';

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
};

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
  deps.store.checkpoints.set(sessionId, checkpoint);
  deps.store.addEvent(sessionId, 'node_status', {
    node: 'direct_reply',
    status: 'running',
    route: 'direct-reply'
  });
  await deps.store.persistRuntimeState();

  const assistantMessageId = `direct_reply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const assistantCreatedAt = new Date().toISOString();
  let streamedMessage: ChatMessageRecord | undefined;
  let tokenCount = 0;

  const content = await llm.streamText(
    buildDirectReplyMessages(input.message, hints),
    {
      role: 'manager',
      modelId: input.modelId ?? hints.requestedHints?.preferredModelId,
      temperature: 0.2,
      maxTokens: 1200
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
    }
  );

  const finalContent = (streamedMessage?.content || content || '').trim();
  const assistantMessage =
    streamedMessage && finalContent
      ? streamedMessage
      : deps.store.addMessage(sessionId, 'assistant', finalContent || '我暂时没有生成有效回复。', 'manager');
  if (streamedMessage && streamedMessage.content !== assistantMessage.content) {
    streamedMessage.content = assistantMessage.content;
  }

  const completedAt = new Date().toISOString();
  session.status = 'completed';
  session.updatedAt = completedAt;
  checkpoint.graphState = {
    ...checkpoint.graphState,
    status: TaskStatus.COMPLETED,
    currentStep: 'direct_reply'
  };
  checkpoint.currentNode = 'direct_reply';
  checkpoint.streamStatus = undefined;
  checkpoint.thinkState = {
    title: checkpoint.thinkState?.title ?? '直接回复',
    content: checkpoint.thinkState?.content ?? '通用聊天模型已完成回复。',
    messageId: checkpoint.thinkState?.messageId,
    thinkingDurationMs: checkpoint.thinkState?.thinkingDurationMs,
    loading: false,
    blink: false
  };
  checkpoint.updatedAt = completedAt;
  deps.store.checkpoints.set(sessionId, checkpoint);
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

function buildDirectReplyMessages(message: string, hints: SessionTurnHints) {
  const recentTurns = (hints.recentTurns ?? [])
    .slice(-6)
    .map(turn => `${turn.role}: ${turn.content}`)
    .join('\n');
  const context = [hints.conversationSummary ? `会话摘要：${hints.conversationSummary}` : '', recentTurns]
    .filter(Boolean)
    .join('\n\n');

  return [
    {
      role: 'system' as const,
      content:
        '你是 agent-chat 的通用聊天模型。直接回答用户问题；不要启动任务编排、六部流程、工具调用、审批或检索。回答应简洁、准确，并使用用户的语言。'
    },
    ...(context
      ? [
          {
            role: 'system' as const,
            content: `可用的近期对话上下文如下，仅在相关时使用：\n${context}`
          }
        ]
      : []),
    {
      role: 'user' as const,
      content: message
    }
  ];
}

function isExecutionOrResearchRequest(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    /^(\/(?:browse|review|qa|ship|plan|plan-ceo-review|plan-eng-review|exec)\b)/i.test(normalized) ||
    /(实现|修改|修复|改一下|重构|新增|加一个|优化|删除|迁移|接入|联调|运行|测试|发布|提交|创建分支|开\s*pr|审批|安装|连接器|生成报表|生成页面|写文件|改代码|查资料|调研|检索|搜索|联网|最新|今天|现在|实时|新闻)/i.test(
      normalized
    ) ||
    /\b(implement|modify|change|fix|refactor|add|delete|migrate|run|test|build|deploy|release|commit|pull request|install|connector|browse|research|search|latest|today|realtime)\b/i.test(
      normalized
    )
  );
}
