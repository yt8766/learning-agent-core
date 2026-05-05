export function buildCodexChatStreamUrl(sessionId: string) {
  return `/api/chat/stream?sessionId=${encodeURIComponent(sessionId)}`;
}

export function closeEventSource(source: EventSource | null | undefined) {
  source?.close();
}
