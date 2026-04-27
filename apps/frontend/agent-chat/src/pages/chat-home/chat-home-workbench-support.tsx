import type { ReactNode } from 'react';

import type { WorkspaceCenterReadinessSummary } from '@/api/workspace-center-api';
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

export interface WorkspaceVaultSignal {
  label: string;
  value: string;
  detail: string;
  tone: 'blue' | 'cyan' | 'geekblue' | 'gold' | 'green' | 'orange' | 'purple';
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

export function buildWorkspaceVaultSignals(
  chat: ReturnType<typeof useChatSession>,
  workspaceCenterReadiness?: WorkspaceCenterReadinessSummary
): WorkspaceVaultSignal[] {
  const checkpoint = chat.checkpoint;
  const sourceSummary = checkpoint?.learningEvaluation?.sourceSummary;
  const externalSourceCount = sourceSummary?.externalSourceCount ?? checkpoint?.externalSources?.length ?? 0;
  const internalSourceCount = sourceSummary?.internalSourceCount ?? 0;
  const reusedMemoryCount = sourceSummary?.reusedMemoryCount ?? checkpoint?.reusedMemories?.length ?? 0;
  const reusedRuleCount = sourceSummary?.reusedRuleCount ?? checkpoint?.reusedRules?.length ?? 0;
  const reusedSkillCount = sourceSummary?.reusedSkillCount ?? checkpoint?.reusedSkills?.length ?? 0;
  const installedSkillCount = checkpoint?.usedInstalledSkills?.length ?? 0;
  const companyWorkerCount = checkpoint?.usedCompanyWorkers?.length ?? 0;
  const connectorCount = checkpoint?.connectorRefs?.length ?? 0;
  const reuseCount = reusedMemoryCount + reusedRuleCount + reusedSkillCount + installedSkillCount + companyWorkerCount;
  const workspaceSignalCount =
    externalSourceCount + internalSourceCount + reusedMemoryCount + reusedRuleCount + reusedSkillCount + connectorCount;
  const candidateCount = checkpoint?.learningEvaluation?.recommendedCandidateIds?.length ?? 0;
  const autoConfirmCandidateCount = checkpoint?.learningEvaluation?.autoConfirmCandidateIds?.length ?? 0;
  const learningConfidence = checkpoint?.learningEvaluation?.confidence;
  const installedReceiptIds =
    checkpoint?.skillSearch?.suggestions.flatMap(suggestion =>
      suggestion.installState?.status === 'installed' ? [suggestion.installState.receiptId] : []
    ) ?? [];
  const capabilityGapDetected = Boolean(checkpoint?.skillSearch?.capabilityGapDetected);
  const recommendationSummary = checkpoint?.skillSearch?.mcpRecommendation?.summary;

  return [
    ...(workspaceCenterReadiness
      ? [
          {
            label: 'Workspace Center',
            value: `${workspaceCenterReadiness.approvedDraftCount + workspaceCenterReadiness.installedDraftCount} ready / ${workspaceCenterReadiness.skillDraftCount} drafts`,
            detail: `approved ${workspaceCenterReadiness.approvedDraftCount} · reuse ${workspaceCenterReadiness.reuseRecordCount} · top ${
              workspaceCenterReadiness.topDraftTitles.length
                ? workspaceCenterReadiness.topDraftTitles.join(', ')
                : workspaceCenterReadiness.workspaceName
            }`,
            tone: 'green'
          } satisfies WorkspaceVaultSignal
        ]
      : []),
    {
      label: 'Workspace signals',
      value: `${workspaceSignalCount} 项`,
      detail: `外部 ${externalSourceCount}，内部 ${internalSourceCount}，复用 ${
        reusedMemoryCount + reusedRuleCount + reusedSkillCount
      }`,
      tone: 'blue'
    },
    {
      label: 'Evidence readiness',
      value: `${externalSourceCount} 条来源`,
      detail: `internal ${internalSourceCount}`,
      tone: 'cyan'
    },
    {
      label: 'Reuse readiness',
      value: `${reuseCount} 项复用`,
      detail: `技能 ${reusedSkillCount + installedSkillCount} · 角色 ${companyWorkerCount} · 连接器 ${connectorCount}`,
      tone: 'purple'
    },
    {
      label: 'Skill draft readiness',
      value: `${candidateCount} 个候选`,
      detail: `auto ${autoConfirmCandidateCount} · confidence ${learningConfidence ?? 'unknown'}`,
      tone: 'green'
    },
    ...(installedReceiptIds.length
      ? [
          {
            label: 'Install receipts',
            value: `${installedReceiptIds.length} installed`,
            detail: installedReceiptIds.join(', '),
            tone: 'green'
          } satisfies WorkspaceVaultSignal
        ]
      : []),
    {
      label: 'Capability gap',
      value: capabilityGapDetected ? '待补强' : '已覆盖',
      detail: recommendationSummary ?? (capabilityGapDetected ? '存在待补能力缺口' : '当前能力覆盖稳定'),
      tone: capabilityGapDetected ? 'orange' : 'geekblue'
    }
  ];
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
