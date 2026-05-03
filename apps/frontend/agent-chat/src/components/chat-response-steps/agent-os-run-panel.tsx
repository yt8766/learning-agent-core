import type { ChatResponseStepsForMessage } from '@/lib/chat-response-step-projections';

import { AgentOsGroup } from './agent-os-group';

type AgentOsRunPanelProps = {
  responseSteps: ChatResponseStepsForMessage;
  defaultOpen: boolean;
};

export function AgentOsRunPanel({ responseSteps, defaultOpen }: AgentOsRunPanelProps) {
  if (responseSteps.displayMode === 'answer_only') {
    return null;
  }

  const groups = responseSteps.agentOsGroups ?? [];

  return (
    <details
      className={`chat-response-steps chat-response-steps--agent-os ${defaultOpen ? 'is-running' : 'is-complete'}`}
      open={defaultOpen}
    >
      <summary className="chat-response-steps__complete-summary">
        <span>{buildResponseStepSummaryTitle(responseSteps)}</span>
        <span className="chat-response-steps__chevron" aria-hidden="true">
          ›
        </span>
      </summary>
      <div className="chat-response-steps__agent-os-groups">
        {groups.map(group => (
          <AgentOsGroup key={group.kind} group={group} />
        ))}
      </div>
    </details>
  );
}

export function buildResponseStepSummaryTitle(responseSteps: ChatResponseStepsForMessage) {
  if (responseSteps.summary.title.includes('用时')) {
    return responseSteps.summary.title;
  }
  const duration = formatResponseStepsDuration(responseSteps.steps);
  return duration ? `${responseSteps.summary.title} · 用时 ${duration}` : responseSteps.summary.title;
}

function formatResponseStepsDuration(steps: ChatResponseStepsForMessage['steps']) {
  const durationMs = steps.reduce((total, step) => total + (step.durationMs ?? 0), 0);
  if (durationMs <= 0) {
    return '';
  }
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
