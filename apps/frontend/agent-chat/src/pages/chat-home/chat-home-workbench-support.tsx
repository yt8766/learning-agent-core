import type { ReactNode } from 'react';

import type { WorkspaceCenterReadinessSummary } from '@/api/workspace-center-api';
import type { useChatSession } from '@/hooks/use-chat-session';
import { buildProjectContextSnapshot } from './chat-home-helpers';
import { buildSubmitMessage, stripLeadingWorkflowCommand } from './chat-home-submit';
export {
  buildThoughtItems,
  buildThoughtItemsFromFields,
  shouldIncludeEventInThoughtLog
} from './chat-home-workbench-thoughts';

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
  tone: 'blue' | 'cyan' | 'gold' | 'green' | 'orange';
}

type SkillInstallState = NonNullable<
  NonNullable<ReturnType<typeof useChatSession>['checkpoint']>['skillSearch']
>['suggestions'][number]['installState'];
type ChatSessionCheckpoint = ReturnType<typeof useChatSession>['checkpoint'];
type ChatSessionMessage = ReturnType<typeof useChatSession>['messages'][number];
type ChatSessionRecord = ReturnType<typeof useChatSession>['activeSession'];
type NonNullableCheckpoint = NonNullable<ChatSessionCheckpoint>;

export interface QuickActionChipsInput {
  activeSession?: Pick<NonNullable<ChatSessionRecord>, 'status'>;
  checkpoint?: Pick<NonNullableCheckpoint, 'graphState'>;
  messages: Array<Pick<ChatSessionMessage, 'content' | 'id' | 'role'>>;
}

export interface WorkspaceVaultSignalsInput {
  activeSession?: Pick<NonNullable<ChatSessionRecord>, 'status'>;
  checkpoint?: Pick<
    NonNullableCheckpoint,
    | 'connectorRefs'
    | 'currentMinistry'
    | 'currentWorker'
    | 'externalSources'
    | 'learningEvaluation'
    | 'reusedMemories'
    | 'reusedRules'
    | 'reusedSkills'
    | 'skillSearch'
    | 'usedCompanyWorkers'
    | 'usedInstalledSkills'
  >;
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
  return buildQuickActionChipsFromFields({
    activeSession: chat.activeSession,
    checkpoint: chat.checkpoint,
    messages: chat.messages
  });
}

export function buildQuickActionChipsFromFields(input: QuickActionChipsInput): QuickActionChip[] {
  const currentStep = input.checkpoint?.graphState?.currentStep;
  const status = input.activeSession?.status;
  const hasSettledAssistantReply = input.messages.some(
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

export function buildWorkspaceFollowUpActionsFromFields(input: QuickActionChipsInput) {
  const chips = buildQuickActionChipsFromFields(input);
  return chips.filter(item => ['继续深挖', '改成计划', '生成执行任务', '输出检查单'].includes(item.label));
}

export function buildWorkspaceVaultSignals(
  chat: ReturnType<typeof useChatSession>,
  workspaceCenterReadiness?: WorkspaceCenterReadinessSummary
): WorkspaceVaultSignal[] {
  return buildWorkspaceVaultSignalsFromFields(
    {
      activeSession: chat.activeSession,
      checkpoint: chat.checkpoint
    },
    workspaceCenterReadiness
  );
}

export function buildWorkspaceVaultSignalsFromFields(
  input: WorkspaceVaultSignalsInput,
  workspaceCenterReadiness?: WorkspaceCenterReadinessSummary
): WorkspaceVaultSignal[] {
  const checkpoint = input.checkpoint;
  const evidenceCount = checkpoint?.externalSources?.length ?? 0;
  const reusedMemoryCount = checkpoint?.reusedMemories?.length ?? 0;
  const reusedRuleCount = checkpoint?.reusedRules?.length ?? 0;
  const reusedSkillCount = checkpoint?.reusedSkills?.length ?? 0;
  const installedSkillCount = checkpoint?.usedInstalledSkills?.length ?? 0;
  const workerCount = checkpoint?.usedCompanyWorkers?.length ?? 0;
  const connectorCount = checkpoint?.connectorRefs?.length ?? 0;
  const learningEvaluation = checkpoint?.learningEvaluation;
  const skillSearch = checkpoint?.skillSearch;
  const workspaceSignalCount =
    evidenceCount + reusedMemoryCount + reusedRuleCount + reusedSkillCount + workerCount + connectorCount;
  const reuseCount = reusedMemoryCount + reusedRuleCount + reusedSkillCount + installedSkillCount + workerCount;
  const skillDraftCandidateCount = learningEvaluation?.recommendedCandidateIds.length ?? 0;
  const skillDraftAutoCount = learningEvaluation?.autoConfirmCandidateIds.length ?? 0;
  const installReceiptSignal = buildInstallReceiptSignal(
    skillSearch?.suggestions.map(suggestion => suggestion.installState).filter(Boolean) ?? []
  );
  const capabilityGapDetail =
    skillSearch?.mcpRecommendation?.summary ||
    skillSearch?.suggestions?.[0]?.displayName ||
    skillSearch?.query ||
    '当前能力可覆盖';

  return [
    {
      label: 'Workspace signals',
      value: `${workspaceSignalCount} 项`,
      detail: checkpoint?.currentWorker ?? checkpoint?.currentMinistry ?? input.activeSession?.status ?? 'idle',
      tone: 'blue'
    },
    {
      label: 'Evidence readiness',
      value: `${evidenceCount} 条来源`,
      detail: `internal ${learningEvaluation?.sourceSummary.internalSourceCount ?? 0}`,
      tone: evidenceCount ? 'cyan' : 'orange'
    },
    {
      label: 'Reuse readiness',
      value: `${reuseCount} 项复用`,
      detail: `技能 ${reusedSkillCount + installedSkillCount} · 角色 ${workerCount} · 连接器 ${connectorCount}`,
      tone: reuseCount ? 'gold' : 'orange'
    },
    {
      label: 'Skill draft readiness',
      value: `${skillDraftCandidateCount} 个候选`,
      detail: `auto ${skillDraftAutoCount} · confidence ${learningEvaluation?.confidence ?? 'none'}`,
      tone: skillDraftCandidateCount ? 'green' : 'orange'
    },
    buildWorkspaceCenterSignal(workspaceCenterReadiness),
    installReceiptSignal,
    {
      label: 'Capability gap',
      value: skillSearch?.capabilityGapDetected ? '待补强' : '已覆盖',
      detail: capabilityGapDetail,
      tone: skillSearch?.capabilityGapDetected ? 'orange' : 'green'
    }
  ].filter(Boolean) as WorkspaceVaultSignal[];
}

function buildWorkspaceCenterSignal(readiness?: WorkspaceCenterReadinessSummary): WorkspaceVaultSignal | null {
  if (!readiness) {
    return null;
  }

  const readyCount = readiness.activeDraftCount;
  const topDrafts = readiness.topDraftTitles.length ? ` · top ${readiness.topDraftTitles.join(', ')}` : '';

  return {
    label: 'Workspace Center',
    value: `${readyCount} ready / ${readiness.skillDraftCount} drafts`,
    detail: `approved ${readiness.approvedDraftCount} · reuse ${readiness.reuseRecordCount}${topDrafts}`,
    tone: readiness.failedDraftCount ? 'orange' : readyCount ? 'green' : 'cyan'
  };
}

function buildInstallReceiptSignal(installStates: SkillInstallState[]): WorkspaceVaultSignal | null {
  if (!installStates.length) {
    return null;
  }

  const installedCount = installStates.filter(state => state?.status === 'installed').length;
  const failedCount = installStates.filter(state => state?.status === 'failed' || state?.status === 'rejected').length;
  const primaryStatus =
    installStates.length === 1 && installStates[0]?.status
      ? `1 ${installStates[0].status}`
      : failedCount
        ? `${failedCount} failed`
        : installedCount
          ? `${installedCount} installed`
          : `${installStates.length} pending`;
  const receiptIds = installStates.map(state => state?.receiptId).filter(Boolean);

  return {
    label: 'Install receipts',
    value: primaryStatus,
    detail: receiptIds.length ? receiptIds.join(' · ') : 'receipt pending',
    tone: failedCount ? 'orange' : installedCount ? 'green' : 'gold'
  };
}

export function buildWorkspaceShareText(chat: ReturnType<typeof useChatSession>) {
  return buildWorkspaceShareTextFromFields({
    activeSession: chat.activeSession,
    checkpoint: chat.checkpoint,
    messages: chat.messages,
    pendingApprovals: chat.pendingApprovals
  });
}

export function buildWorkspaceShareTextFromFields(input: Parameters<typeof buildProjectContextSnapshot>[0]) {
  const snapshot = buildProjectContextSnapshot(input);
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
