import { QueryClientProvider } from '@tanstack/react-query';

import { chatQueryClient } from '@/lib/query-client';
import { ChatHomePage } from '@/pages/chat-home/chat-home-page';

export default function App() {
  return (
    <QueryClientProvider client={chatQueryClient}>
      <ChatHomePage />
    </QueryClientProvider>
  );
}
