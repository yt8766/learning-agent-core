import { CodexChatLayout } from './codex-chat-layout';
import { useCodexChatSession } from '../hooks/use-codex-chat-session';

export function CodexChatShell() {
  const chat = useCodexChatSession();

  return <CodexChatLayout chat={chat} />;
}
