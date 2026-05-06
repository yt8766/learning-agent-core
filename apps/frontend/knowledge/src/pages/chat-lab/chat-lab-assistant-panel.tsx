import { Button } from 'antd';

import type { ChatAssistantConfig } from '../../types/api';

export function ChatLabAssistantPrompts({
  config,
  onPromptSelect
}: {
  config: ChatAssistantConfig | null;
  onPromptSelect: (prompt: string) => void;
}) {
  const prompts = config?.quickPrompts ?? [];
  if (prompts.length === 0) {
    return null;
  }

  return (
    <div className="knowledge-chat-empty-prompts">
      {config?.thinkingSteps?.length ? (
        <div className="knowledge-chat-thinking-steps">
          {config.thinkingSteps.map(step => (
            <span className="knowledge-chat-thinking-step" key={step.id}>
              {step.label}
            </span>
          ))}
        </div>
      ) : null}
      {prompts.map(prompt => (
        <Button key={prompt} onClick={() => onPromptSelect(prompt)} type="default">
          {prompt}
        </Button>
      ))}
    </div>
  );
}
