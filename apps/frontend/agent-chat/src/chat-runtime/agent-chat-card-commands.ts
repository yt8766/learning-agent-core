import type { AgentChatCardCommand } from './agent-chat-types';

export function buildApprovalCardCommands(surfaceId: string, title: string): AgentChatCardCommand[] {
  return [
    { version: 'v0.9', createSurface: { surfaceId, catalogId: 'local://agent-chat-card.json' } },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId,
        components: [
          { id: 'root', component: 'Column', children: ['title'] },
          { id: 'title', component: 'Text', text: title }
        ]
      }
    }
  ];
}
