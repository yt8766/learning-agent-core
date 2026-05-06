import type { ChatSessionRecord } from '../types/chat';

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function toConversationLabel(session: ChatSessionRecord) {
  return session.title?.trim() || '新对话';
}

export function sanitizeGeneratedTitle(raw: string) {
  const dataLines = raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('data:'))
    .map(line => line.replace(/^data:\s*/, ''))
    .filter(Boolean);
  let candidate = raw;

  if (dataLines.length > 0) {
    const chunks = dataLines
      .map(line => {
        try {
          const parsed = JSON.parse(line) as Record<string, unknown>;
          const data =
            typeof parsed.data === 'object' && parsed.data ? (parsed.data as Record<string, unknown>) : undefined;
          return readString(parsed.content) ?? readString(parsed.text) ?? readString(data?.content) ?? '';
        } catch {
          return '';
        }
      })
      .join('');
    candidate = chunks || dataLines.at(-1) || raw;
  }

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    const data = typeof parsed.data === 'object' && parsed.data ? (parsed.data as Record<string, unknown>) : undefined;
    candidate =
      readString(parsed.title) ??
      readString(parsed.content) ??
      readString(parsed.message) ??
      readString(parsed.text) ??
      readString(data?.title) ??
      readString(data?.content) ??
      candidate;
  } catch {
    // Plain text title responses are expected.
  }

  return candidate
    .replace(/```[\s\S]*?```/g, '')
    .trim()
    .replace(/^标题[:：]/, '')
    .replace(/[“”"'`]/g, '')
    .replace(/[。！？!?，,；;：:]/g, '')
    .trim()
    .slice(0, 18);
}

export function fallbackTitleFromMessage(message: string) {
  return (
    message
      .replace(/\s+/g, '')
      .replace(/[。！？!?，,；;：:]/g, '')
      .slice(0, 14) || '新对话'
  );
}
