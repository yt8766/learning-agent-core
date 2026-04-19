import type { QueryClient } from '@tanstack/react-query';

import { listSessions, selectSession } from '@/api/chat-api';

export const chatQueryKeys = {
  sessions: () => ['chat', 'sessions'] as const,
  session: (sessionId: string) => ['chat', 'session', sessionId] as const
};

export function fetchChatSessions(queryClient: QueryClient) {
  return queryClient.fetchQuery({
    queryKey: chatQueryKeys.sessions(),
    queryFn: listSessions,
    staleTime: 1_000
  });
}

export function fetchChatSession(queryClient: QueryClient, sessionId: string) {
  return queryClient.fetchQuery({
    queryKey: chatQueryKeys.session(sessionId),
    queryFn: () => selectSession(sessionId),
    staleTime: 0
  });
}
