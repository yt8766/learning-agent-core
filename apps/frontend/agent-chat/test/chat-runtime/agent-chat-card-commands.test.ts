import { describe, expect, it } from 'vitest';

import { buildApprovalCardCommands } from '@/chat-runtime/agent-chat-card-commands';

describe('buildApprovalCardCommands', () => {
  it('returns A2UI v0.9 create and update commands for an approval card surface', () => {
    const commands = buildApprovalCardCommands('approval-surface', '等待审批');

    expect(commands).toHaveLength(2);
    expect(commands[0]).toEqual({
      version: 'v0.9',
      createSurface: {
        surfaceId: 'approval-surface',
        catalogId: 'local://agent-chat-card.json'
      }
    });
    expect(commands[1]).toEqual({
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'approval-surface',
        components: [
          { id: 'root', component: 'Column', children: ['title'] },
          { id: 'title', component: 'Text', text: '等待审批' }
        ]
      }
    });
  });
});
