import { Button } from 'antd';
import { useState } from 'react';

import { CopyIcon, ThumbDownIcon, ThumbUpIcon } from './chatbot-icons';

export async function copyMessageText(text: string): Promise<boolean> {
  const trimmedText = text.trim();
  const clipboard = globalThis.navigator?.clipboard;

  if (!trimmedText || !clipboard?.writeText) {
    return false;
  }

  try {
    await clipboard.writeText(trimmedText);
    return true;
  } catch {
    return false;
  }
}

export function MessageActions({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const didCopy = await copyMessageText(content);

    setCopied(didCopy);
    if (didCopy) {
      window.setTimeout(() => setCopied(false), 1400);
    }
  }

  return (
    <div className="codex-message-actions" aria-label="消息操作">
      <Button
        aria-label="复制消息"
        className="codex-message-action-button"
        icon={<CopyIcon />}
        onClick={handleCopy}
        size="small"
        type="text"
      >
        {copied ? '已复制' : '复制'}
      </Button>
      <Button
        aria-label="赞同回复"
        className="codex-message-action-button"
        icon={<ThumbUpIcon />}
        size="small"
        type="text"
      />
      <Button
        aria-label="不赞同回复"
        className="codex-message-action-button"
        icon={<ThumbDownIcon />}
        size="small"
        type="text"
      />
    </div>
  );
}
