import { Typography } from 'antd';
import type { CollapseProps } from 'antd';

import type { useChatSession } from '@/hooks/use-chat-session';
import { getCompressionHint, getRunningHint } from './chat-home-helpers';
import { normalizeExecutionMode } from '@/lib/runtime-semantics';
import {
  renderApprovalHistorySection,
  renderCabinetSection,
  renderEventStreamSection,
  renderEvidenceSection,
  renderLearningSection,
  renderReuseSection,
  renderSpecialistSection
} from './chat-home-workbench-section-renders';

// activeInterrupt is the persisted 司礼监 / InterruptController projection for the workbench.
const { Text } = Typography;

export interface StreamEventRecord {
  id: string;
  type: string;
  summary: string;
  at: string;
  raw: string;
}

export interface WorkbenchSectionState {
  runningHint: string | undefined;
  compressionHint: string | undefined;
  llmFallbackNotes: string[];
  workbenchItems: NonNullable<CollapseProps['items']>;
}

function getCheckpointInteractionKind(checkpoint?: ReturnType<typeof useChatSession>['checkpoint']) {
  const payload = checkpoint?.activeInterrupt?.payload;
  if (
    payload &&
    typeof payload === 'object' &&
    typeof (payload as { interactionKind?: unknown }).interactionKind === 'string'
  ) {
    return (payload as { interactionKind: 'approval' | 'plan-question' | 'supplemental-input' }).interactionKind;
  }
  if (checkpoint?.activeInterrupt?.kind === 'user-input') {
    return 'plan-question';
  }
  if (checkpoint?.activeInterrupt || checkpoint?.pendingApproval) {
    return 'approval';
  }
  return undefined;
}

export function getWorkbenchInterruptCopy(checkpoint?: ReturnType<typeof useChatSession>['checkpoint']) {
  const interactionKind = getCheckpointInteractionKind(checkpoint);
  if (interactionKind === 'plan-question') {
    return {
      tag: '计划提问',
      summary: checkpoint?.planDraft?.questionSet?.title ?? '等待方案澄清',
      detail: checkpoint?.planDraft?.questionSet?.summary ?? '当前仍在方案收敛阶段，等待你回答关键问题后再继续推进。'
    };
  }
  if (interactionKind === 'supplemental-input') {
    return {
      tag: '补充输入',
      summary: checkpoint?.activeInterrupt?.intent ?? '等待补充上下文',
      detail: checkpoint?.activeInterrupt?.reason ?? '当前需要更多信息才能继续执行。'
    };
  }
  if (interactionKind === 'approval') {
    return {
      tag: '操作确认',
      summary: checkpoint?.pendingApproval?.toolName ?? checkpoint?.activeInterrupt?.toolName ?? '等待操作确认',
      detail: checkpoint?.pendingApproval?.reason ?? checkpoint?.activeInterrupt?.reason ?? '当前存在待确认操作。'
    };
  }
  return undefined;
}

export function buildWorkbenchSectionState(
  chat: ReturnType<typeof useChatSession>,
  streamEvents: StreamEventRecord[]
): WorkbenchSectionState {
  const runningHint = getRunningHint(chat.activeSession?.status, chat.checkpoint?.graphState?.currentStep);
  const compressionHint = getCompressionHint(chat.activeSession);
  const routeSummary = chat.checkpoint?.modelRoute?.[(chat.checkpoint?.modelRoute?.length ?? 1) - 1];
  const activeMode = normalizeExecutionMode(chat.checkpoint?.executionMode);
  const llmFallbackNotes = (chat.checkpoint?.agentStates ?? [])
    .flatMap(state => state.observations ?? [])
    .filter(note => note.startsWith('LLM '));
  const approvalHistory = chat.events
    .filter(
      event =>
        event.type === 'approval_resolved' ||
        event.type === 'approval_rejected_with_feedback' ||
        event.type === 'interrupt_resumed' ||
        event.type === 'interrupt_rejected_with_feedback'
    )
    .slice()
    .reverse()
    .map(event => {
      const payload = event.payload ?? {};
      return {
        id: event.id,
        intent: typeof payload.intent === 'string' ? payload.intent : 'unknown',
        toolName: typeof payload.toolName === 'string' ? payload.toolName : '',
        feedback: typeof payload.feedback === 'string' ? payload.feedback : '',
        reason: typeof payload.reason === 'string' ? payload.reason : '',
        at: event.at,
        status:
          event.type === 'approval_resolved' || event.type === 'interrupt_resumed'
            ? ('approved' as const)
            : ('rejected' as const)
      };
    });

  const interruptCopy = getWorkbenchInterruptCopy(chat.checkpoint);
  const workbenchItemsRaw = [
    renderCabinetSection({ chat, routeSummary, activeMode, interruptCopy }),
    renderSpecialistSection(chat),
    renderEvidenceSection(chat),
    renderLearningSection(chat),
    renderReuseSection(chat),
    renderApprovalHistorySection(approvalHistory),
    renderEventStreamSection(streamEvents)
  ];

  return {
    runningHint,
    compressionHint,
    llmFallbackNotes,
    workbenchItems: workbenchItemsRaw.filter(Boolean) as NonNullable<CollapseProps['items']>
  };
}

export function ChatHomeApprovalActions({ chat }: { chat: ReturnType<typeof useChatSession> }) {
  return (
    <>
      {chat.activeSession?.status === 'failed' || chat.activeSession?.status === 'cancelled' ? (
        <AlertFailureItem />
      ) : null}
    </>
  );
}

function AlertFailureItem() {
  return (
    <article className="chatx-running-alert ant-alert ant-alert-error ant-alert-with-description ant-alert-no-icon">
      <div className="ant-alert-content">
        <div className="ant-alert-message">当前轮次已停止</div>
        <div className="ant-alert-description">
          <Text type="secondary">可以在顶部运行控制区选择“恢复执行”，基于现有上下文继续执行。</Text>
        </div>
      </div>
    </article>
  );
}
