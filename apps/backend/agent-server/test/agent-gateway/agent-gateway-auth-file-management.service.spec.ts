import { describe, expect, it } from 'vitest';
import { AgentGatewayAuthFileManagementService } from '../../src/domains/agent-gateway/auth-files/agent-gateway-auth-file-management.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

describe('AgentGatewayAuthFileManagementService', () => {
  it('supports list, batch upload, field patch, model listing, download, and delete', async () => {
    const service = new AgentGatewayAuthFileManagementService(new MemoryAgentGatewayManagementClient());

    await expect(
      service.batchUpload({
        files: [{ fileName: 'gemini.json', contentBase64: 'e30=', providerKind: 'gemini' }]
      })
    ).resolves.toMatchObject({ accepted: [{ fileName: 'gemini.json' }] });

    await expect(service.list({ query: 'gemini', limit: 20 })).resolves.toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ fileName: 'gemini.json' })])
    });
    await expect(service.patchFields({ authFileId: 'gemini.json', metadata: { priority: 1 } })).resolves.toMatchObject({
      id: 'gemini.json'
    });
    await expect(service.models('gemini.json')).resolves.toMatchObject({ authFileId: 'gemini.json' });
    await expect(service.download('gemini.json')).resolves.toContain('gemini');
    await expect(service.delete({ names: ['gemini.json'] })).resolves.toMatchObject({ deleted: ['gemini.json'] });
  });
});
