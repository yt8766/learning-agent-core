import type { ChatCheckpointRecord, ChatMessageRecord, ChatSessionRecord } from '@agent/core';
import type { ContextStrategy } from '@agent/config';
import type { MemorySearchService } from '@agent/memory';

import { archivalMemorySearchByParams } from '../memory/active-memory-tools';
import { flattenStructuredMemories } from '../memory/runtime-memory-search';
import { applyReactiveCompactRetry, buildContextCompressionResult } from '../utils/context-compression-pipeline';
import { sanitizeTaskContextForModel } from '../utils/prompts/runtime-output-sanitizer';

const CONTEXT_MESSAGE_WINDOW = 10;
const CONTEXT_MESSAGE_MAX_CHARS = 320;
const META_CONVERSATION_RECALL_PATTERN =
  /(刚刚聊了什么|刚才聊了什么|我们刚刚聊了什么|上一轮聊了什么|回顾一下刚刚|总结一下刚刚|recap (what )?we just talked|what did we just talk)/i;

export async function buildSessionConversationContext(
  session: ChatSessionRecord,
  checkpoint: ChatCheckpointRecord | undefined,
  messages: ChatMessageRecord[],
  query: string,
  contextStrategy: ContextStrategy | undefined,
  memorySearchService: MemorySearchService | undefined
): Promise<string> {
  const recentTurns = contextStrategy?.recentTurns ?? CONTEXT_MESSAGE_WINDOW;
  const ragTopK = contextStrategy?.ragTopK ?? 4;
  const recentMessages = messages.filter(message => message.role !== 'system').slice(-recentTurns);
  const sanitizedCheckpointContext = sanitizeTaskContextForModel(checkpoint?.context);
  const summaryBlock = session.compression?.summary
    ? ['以下是较早聊天记录的压缩摘要：', formatCompressionContext(session.compression), '以下是最近的原始消息：'].join(
        '\n'
      )
    : '';
  const taskCompression = buildContextCompressionResult({
    goal: query,
    context: sanitizedCheckpointContext,
    trace: checkpoint?.thoughtGraph?.nodes?.map(node => ({ id: node.id })) as never,
    planDraft: undefined,
    plan: undefined
  });
  const resilientTaskCompression =
    taskCompression.compactedCharacterCount > 320
      ? applyReactiveCompactRetry(taskCompression, 'session-context-build', '会话上下文已进行应急压缩。')
      : taskCompression;
  const taskContextBlock = sanitizedCheckpointContext
    ? ['以下是上一轮任务留下的结构化上下文：', resilientTaskCompression.summary].join('\n')
    : '';
  const memoryReuseEvidence = (checkpoint?.externalSources ?? []).filter(
    source => source.sourceType === 'memory_reuse'
  );
  const ruleReuseEvidence = (checkpoint?.externalSources ?? []).filter(source => source.sourceType === 'rule_reuse');
  const memoryBlock =
    memoryReuseEvidence.length > 0
      ? [
          '以下是上一轮命中的历史经验，请只挑和当前问题直接相关的部分使用：',
          memoryReuseEvidence
            .slice(0, ragTopK)
            .map(item => `- ${item.summary.replace(/^已命中历史记忆：/, '')}`)
            .join('\n')
        ].join('\n')
      : '';
  const ruleBlock =
    ruleReuseEvidence.length > 0
      ? [
          '以下是上一轮命中的规则，请结合当前用户问题判断是否仍然适用：',
          ruleReuseEvidence
            .slice(0, ragTopK)
            .map(item => `- ${item.summary.replace(/^已命中历史规则：/, '')}`)
            .join('\n')
        ].join('\n')
      : '';
  const skillBlock =
    checkpoint?.reusedSkills && checkpoint.reusedSkills.length > 0
      ? [
          '以下是上一轮命中的技能：',
          checkpoint.reusedSkills
            .slice(0, ragTopK)
            .map(item => `- ${item}`)
            .join('\n')
        ].join('\n')
      : '';
  const evidenceBlock =
    checkpoint?.externalSources && checkpoint.externalSources.length > 0
      ? [
          '以下是可参考的历史证据：',
          checkpoint.externalSources
            .slice(0, ragTopK)
            .map(
              source => `- [${source.trustClass}] ${source.summary}${source.sourceUrl ? ` (${source.sourceUrl})` : ''}`
            )
            .join('\n')
        ].join('\n')
      : '';
  const learningBlock = checkpoint?.learningEvaluation
    ? [
        '以下是上一轮 learning 评估：',
        `- score: ${checkpoint.learningEvaluation.score}`,
        `- confidence: ${checkpoint.learningEvaluation.confidence}`,
        ...(checkpoint.learningEvaluation.notes ?? []).slice(0, ragTopK).map(note => `- ${note}`)
      ].join('\n')
    : '';
  const retrieved = await archivalMemorySearchByParams(memorySearchService, {
    query,
    limit: Math.max(ragTopK, 5),
    actorRole: 'agent-chat-user',
    scopeType: 'session',
    allowedScopeTypes: ['session', 'user', 'workspace', 'task'],
    userId: checkpoint?.channelIdentity?.channelUserId ?? session.channelIdentity?.channelUserId,
    taskId: checkpoint?.taskId,
    memoryTypes: ['preference', 'constraint', 'procedure', 'skill-experience', 'failure-pattern'],
    includeRules: true,
    includeReflections: true
  });
  const retrievedMemories = flattenStructuredMemories(retrieved);
  const retrievedMemoryBlock =
    retrievedMemories.length > 0
      ? [
          '以下是本轮按当前问题再次检索出的核心记忆，请优先使用当前用户偏好、任务约束和已验证经验：',
          retrievedMemories
            .slice(0, ragTopK)
            .map(item => `- ${item.summary}`)
            .join('\n')
        ].join('\n')
      : '';
  const retrievedRuleBlock =
    retrieved?.rules && retrieved.rules.length > 0
      ? [
          '以下是本轮按当前问题再次检索出的规则：',
          retrieved.rules
            .slice(0, ragTopK)
            .map(item => `- ${item.summary}`)
            .join('\n')
        ].join('\n')
      : '';
  const reflectionBlock =
    retrieved?.reflections && retrieved.reflections.length > 0
      ? [
          '以下是与当前问题相关的历史反思，请优先避免重复失败并复用已验证策略：',
          ...retrieved.reflections.slice(0, 2).map(item => `- ${formatReflection(item)}`)
        ].join('\n')
      : '';
  const messageBlock = recentMessages
    .map(message =>
      formatConversationContextMessage(message.role, sanitizeTaskContextForModel(message.content) || message.content)
    )
    .join('\n');
  const metaConversationBlock = META_CONVERSATION_RECALL_PATTERN.test(query.trim())
    ? [
        '当前用户在询问刚才的对话内容。',
        '请优先基于最近几轮用户与 assistant 的真实对话做简洁回顾，不要直接复读上一轮完整回答，也不要把 system 卡片、运行态提示或审批文案当成用户对话。'
      ].join('\n')
    : '';
  const currentQueryBlock = query.trim() ? ['当前用户最新问题：', query.trim()].join('\n') : '';

  return [
    summaryBlock,
    taskContextBlock,
    metaConversationBlock,
    messageBlock,
    learningBlock,
    memoryBlock,
    ruleBlock,
    skillBlock,
    evidenceBlock,
    retrievedMemoryBlock,
    retrievedRuleBlock,
    reflectionBlock,
    currentQueryBlock
  ]
    .filter(Boolean)
    .join('\n\n');
}

function formatCompressionContext(compression: NonNullable<ChatSessionRecord['compression']>) {
  const sections = [
    compression.periodOrTopic ? `主题 / 时段：${compression.periodOrTopic}` : '',
    compression.focuses?.length ? ['一级重点：', ...compression.focuses.map(item => `- ${item}`)].join('\n') : '',
    compression.keyDeliverables?.length
      ? ['关键交付：', ...compression.keyDeliverables.map(item => `- ${item}`)].join('\n')
      : '',
    compression.risks?.length ? ['风险与缺口：', ...compression.risks.map(item => `- ${item}`)].join('\n') : '',
    compression.nextActions?.length
      ? ['后续动作：', ...compression.nextActions.map(item => `- ${item}`)].join('\n')
      : '',
    compression.decisionSummary ? `已确认决策：${compression.decisionSummary}` : '',
    compression.confirmedPreferences?.length
      ? ['用户偏好 / 约束：', ...compression.confirmedPreferences.map(item => `- ${item}`)].join('\n')
      : '',
    compression.openLoops?.length ? ['未完成事项：', ...compression.openLoops.map(item => `- ${item}`)].join('\n') : '',
    compression.supportingFacts?.length
      ? ['补充事实：', ...compression.supportingFacts.map(item => `- ${item}`)].join('\n')
      : '',
    compression.summary
  ].filter(Boolean);

  return sections.join('\n');
}

function formatConversationContextMessage(role: 'user' | 'assistant' | 'system', content: string) {
  const normalized = content.trim().replace(/\s+/g, ' ');
  const clipped =
    normalized.length > CONTEXT_MESSAGE_MAX_CHARS
      ? `${normalized.slice(0, CONTEXT_MESSAGE_MAX_CHARS)}...(truncated)`
      : normalized;
  return `${role}: ${clipped}`;
}

function formatReflection(
  reflection: NonNullable<Awaited<ReturnType<typeof archivalMemorySearchByParams>>>['reflections'][number]
) {
  const advice = reflection.nextAttemptAdvice.slice(0, 2).join('；');
  return advice ? `${reflection.summary}；下次建议：${advice}` : reflection.summary;
}
