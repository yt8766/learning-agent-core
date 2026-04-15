import type { ReactNode } from 'react';

import type { useChatSession } from '@/hooks/use-chat-session';
import { buildProjectContextSnapshot } from './chat-home-helpers';
import { buildSubmitMessage, stripLeadingWorkflowCommand } from './chat-home-submit';
export { buildThoughtItems } from './chat-home-workbench-thoughts';

export interface QuickActionChip {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: 'primary' | 'secondary';
}

const QUICK_SUGGESTIONS: QuickActionChip[] = [
  {
    label: '普通聊天',
    value: '请直接回答我接下来的问题，并在必要时给出简短依据',
    icon: <span>·</span>,
    tone: 'secondary'
  },
  {
    label: '代码修改',
    value: '/browse 请帮我分析当前代码并给出修改方案',
    icon: <span>{`{}`}</span>,
    tone: 'secondary'
  },
  { label: '审查风险', value: '/review 请审查我当前会话里的改动和风险', icon: <span>!</span>, tone: 'secondary' },
  { label: '研究整理', value: '/qa 请帮我调研这个问题并整理关键结论', icon: <span>#</span>, tone: 'secondary' }
];

export function resolveSuggestedDraftSubmission(input: string, suggestedPayload: string | null) {
  const normalizedValue = input.trim();
  if (suggestedPayload && normalizedValue === stripLeadingWorkflowCommand(suggestedPayload)) {
    return {
      display: normalizedValue,
      payload: suggestedPayload
    };
  }

  return buildSubmitMessage(input);
}

export function shouldShowMissionControl(chat: ReturnType<typeof useChatSession>) {
  const hasDialogue = chat.messages.some(message => message.role === 'user' || message.role === 'assistant');
  if (hasDialogue) {
    return false;
  }

  if (chat.pendingApprovals.length) {
    return true;
  }

  const status = chat.activeSession?.status;
  if (status && status !== 'idle') {
    return true;
  }

  return Boolean(
    chat.checkpoint?.currentMinistry ||
    chat.checkpoint?.currentWorker ||
    chat.checkpoint?.chatRoute ||
    chat.checkpoint?.thinkState?.content
  );
}

export function buildQuickActionChips(chat: ReturnType<typeof useChatSession>): QuickActionChip[] {
  const currentStep = chat.checkpoint?.graphState?.currentStep;
  const status = chat.activeSession?.status;
  const hasSettledAssistantReply = chat.messages.some(
    message => message.role === 'assistant' && message.content.trim() && !message.id.startsWith('pending_assistant_')
  );
  const resultFollowUps: QuickActionChip[] = hasSettledAssistantReply
    ? [
        {
          label: '继续深挖',
          value: '/qa 请基于刚才的结论继续深挖最关键的风险、假设和下一步',
          icon: <span>+</span>,
          tone: 'secondary'
        },
        {
          label: '改成计划',
          value: '/plan-eng-review 请把刚才的结论改写成一个可执行计划',
          icon: <span>^</span>,
          tone: 'secondary'
        },
        {
          label: '生成执行任务',
          value: '/browse 请基于刚才的结论生成下一步执行任务并继续推进',
          icon: <span>{`{}`}</span>,
          tone: 'secondary'
        },
        {
          label: '输出检查单',
          value: '/qa 请基于刚才的结论生成检查单和验收标准',
          icon: <span>@</span>,
          tone: 'secondary'
        }
      ]
    : [];
  const contextChildren: QuickActionChip[] =
    currentStep === 'review'
      ? [
          {
            label: '列出风险与回归点',
            value: '/review 请按严重程度列出风险、回归点和缺失测试',
            icon: <span>!</span>,
            tone: 'secondary'
          },
          { label: '给出发布前检查单', value: '/qa 请给我一份发布前检查单', icon: <span>@</span>, tone: 'secondary' }
        ]
      : currentStep === 'execute'
        ? [
            {
              label: '给出下一步改动',
              value: '/browse 请基于当前进度给我下一步最小改动方案',
              icon: <span>^</span>,
              tone: 'secondary'
            },
            { label: '先补测试再继续', value: '/qa 请先列出本轮最该补的测试', icon: <span>#</span>, tone: 'secondary' }
          ]
        : [
            {
              label: '审查改动',
              value: '/review 请审查我当前会话里的改动和风险',
              icon: <span>!</span>,
              tone: 'secondary'
            },
            {
              label: '列测试点',
              value: '/qa 请帮我列出这个需求的测试点和验收标准',
              icon: <span>#</span>,
              tone: 'secondary'
            }
          ];

  const chips = [
    ...resultFollowUps,
    ...QUICK_SUGGESTIONS,
    ...(status === 'running' ? contextChildren : contextChildren.slice(0, 2))
  ];

  const deduped = chips.filter(
    (item, index, list) => list.findIndex(candidate => candidate.label === item.label) === index
  );

  return deduped.slice(0, 5);
}

export function buildWorkspaceFollowUpActions(chat: ReturnType<typeof useChatSession>) {
  const chips = buildQuickActionChips(chat);
  return chips.filter(item => ['继续深挖', '改成计划', '生成执行任务', '输出检查单'].includes(item.label));
}

export function buildWorkspaceShareText(chat: ReturnType<typeof useChatSession>) {
  const snapshot = buildProjectContextSnapshot(chat);
  const lines = [
    `当前目标：${snapshot.objective}`,
    `最新结论：${snapshot.latestOutcome}`,
    `来源数：${snapshot.evidenceCount}`,
    `技能数：${snapshot.skillCount}`,
    `连接器数：${snapshot.connectorCount}`,
    snapshot.currentWorker ? `当前执行者：${snapshot.currentWorker}` : '',
    snapshot.currentMinistry ? `当前执行线：${snapshot.currentMinistry}` : ''
  ].filter(Boolean);

  return lines.join('\n');
}
