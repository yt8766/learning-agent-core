import type { ChatAgentOsGroup } from '@agent/core';

import { AgentOsStepItem } from './agent-os-step-item';

type AgentOsGroupProps = {
  group: ChatAgentOsGroup;
};

export function AgentOsGroup({ group }: AgentOsGroupProps) {
  return (
    <section className={`chat-response-steps__agent-os-group is-${group.status}`}>
      <header className="chat-response-steps__agent-os-group-header">
        <span className="chat-response-steps__agent-os-group-title">{group.title}</span>
        {group.summary ? <span className="chat-response-steps__agent-os-group-summary">{group.summary}</span> : null}
      </header>
      <ol className="chat-response-steps__agent-os-step-list">
        {group.steps.map(step => (
          <AgentOsStepItem key={step.id} step={step} />
        ))}
      </ol>
    </section>
  );
}
