import { describe, expect, it, vi } from 'vitest';

import {
  resolveRemoteSkillInstallStatusMeta,
  handleCreateSkillIntent,
  handleInstallRemoteSkillIntent
} from '../../src/chat/chat-capability-intents-skills';

describe('resolveRemoteSkillInstallStatusMeta', () => {
  it('returns installed meta', () => {
    const result = resolveRemoteSkillInstallStatusMeta('installed');
    expect(result.title).toContain('已安装');
    expect(result.label).toBe('installed');
    expect(result.itemStatus).toBe('active');
  });

  it('returns failed meta', () => {
    const result = resolveRemoteSkillInstallStatusMeta('failed');
    expect(result.title).toContain('失败');
    expect(result.label).toBe('failed');
    expect(result.itemStatus).toBe('failed');
  });

  it('returns rejected meta', () => {
    const result = resolveRemoteSkillInstallStatusMeta('rejected');
    expect(result.title).toContain('拒绝');
    expect(result.label).toBe('rejected');
    expect(result.itemStatus).toBe('rejected');
  });

  it('returns pending meta', () => {
    const result = resolveRemoteSkillInstallStatusMeta('pending');
    expect(result.title).toContain('待审批');
    expect(result.label).toBe('pending');
    expect(result.itemStatus).toBe('approval-sensitive');
  });

  it('returns approved meta', () => {
    const result = resolveRemoteSkillInstallStatusMeta('approved');
    expect(result.title).toContain('安装中');
    expect(result.label).toBe('approved');
    expect(result.itemStatus).toBe('installing');
  });

  it('returns default meta for unknown status', () => {
    const result = resolveRemoteSkillInstallStatusMeta('custom');
    expect(result.title).toContain('安装中');
    expect(result.label).toBe('custom');
    expect(result.itemStatus).toBe('custom');
  });

  it('returns default meta for undefined status', () => {
    const result = resolveRemoteSkillInstallStatusMeta(undefined);
    expect(result.label).toBe('installing');
    expect(result.itemStatus).toBe('installing');
  });

  it('returns default meta for empty string status', () => {
    const result = resolveRemoteSkillInstallStatusMeta('');
    expect(result.label).toBe('');
    expect(result.itemStatus).toBe('');
  });
});

describe('handleCreateSkillIntent', () => {
  function createMockInput(overrides: Record<string, any> = {}) {
    const mockMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: 'created',
      conversationId: 'conv-1',
      createdAt: '2026-05-11T12:00:00.000Z'
    };
    return {
      sessionId: 'sess-1',
      dto: { conversationId: 'conv-1', content: 'create skill' } as any,
      intent: { description: 'data analysis skill' },
      runtimeSkillCatalogService: {
        createUserSkillDraft: vi.fn(async () => ({
          id: 'skill-1',
          name: 'Data Analysis',
          description: 'Analyzes data',
          status: 'draft',
          ownership: { ownerType: 'user-attached', ownerId: 'user-1' },
          steps: [{ title: 'Step 1', instruction: 'Do thing', toolNames: ['tool1'] }],
          toolContract: { required: ['tool1'], optional: ['tool2'], approvalSensitive: [] },
          connectorContract: { preferred: ['github'], required: [] },
          createdAt: '2026-05-11T12:00:00.000Z',
          updatedAt: '2026-05-11T12:00:00.000Z',
          ...overrides
        }))
      },
      runtimeSessionService: {
        attachSessionCapabilities: vi.fn(async () => {}),
        appendInlineCapabilityResponse: vi.fn(async () => mockMessage)
      }
    };
  }

  it('creates skill draft and attaches capabilities', async () => {
    const input = createMockInput();
    const result = await handleCreateSkillIntent(input);
    expect(input.runtimeSkillCatalogService.createUserSkillDraft).toHaveBeenCalledWith({
      prompt: 'data analysis skill',
      displayName: undefined,
      sessionId: 'sess-1'
    });
    expect(input.runtimeSessionService.attachSessionCapabilities).toHaveBeenCalled();
    expect(input.runtimeSessionService.appendInlineCapabilityResponse).toHaveBeenCalled();
    expect(result.id).toBe('msg-1');
  });

  it('passes displayName to createUserSkillDraft', async () => {
    const input = createMockInput();
    input.intent.displayName = 'My Skill';
    await handleCreateSkillIntent(input);
    expect(input.runtimeSkillCatalogService.createUserSkillDraft).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'My Skill' })
    );
  });

  it('handles missing ownership with fallback', async () => {
    const input = createMockInput({ ownership: undefined });
    await handleCreateSkillIntent(input);
    const attachCall = input.runtimeSessionService.attachSessionCapabilities.mock.calls[0];
    expect(attachCall[1].attachments[0].owner.ownerType).toBe('user-attached');
  });

  it('handles missing steps with fallback', async () => {
    const input = createMockInput({ steps: undefined });
    await handleCreateSkillIntent(input);
    const attachCall = input.runtimeSessionService.attachSessionCapabilities.mock.calls[0];
    expect(attachCall[1].attachments[0].metadata.steps).toEqual([]);
  });

  it('handles missing toolContract with fallback to requiredTools', async () => {
    const input = createMockInput({ toolContract: undefined, requiredTools: ['tool-a'] });
    await handleCreateSkillIntent(input);
    const attachCall = input.runtimeSessionService.attachSessionCapabilities.mock.calls[0];
    expect(attachCall[1].attachments[0].metadata.requiredTools).toEqual(['tool-a']);
  });

  it('handles missing connectorContract with fallback', async () => {
    const input = createMockInput({
      connectorContract: undefined,
      preferredConnectors: ['github'],
      requiredConnectors: ['slack']
    });
    await handleCreateSkillIntent(input);
    const attachCall = input.runtimeSessionService.attachSessionCapabilities.mock.calls[0];
    expect(attachCall[1].attachments[0].metadata.preferredConnectors).toEqual(['github']);
    expect(attachCall[1].attachments[0].metadata.requiredConnectors).toEqual(['slack']);
  });

  it('builds correct card payload', async () => {
    const input = createMockInput();
    const appendCall = input.runtimeSessionService.appendInlineCapabilityResponse;
    await handleCreateSkillIntent(input);
    const payload = appendCall.mock.calls[0][2];
    expect(payload.card.type).toBe('skill_draft_created');
    expect(payload.card.skillId).toBe('skill-1');
    expect(payload.card.displayName).toBe('Data Analysis');
    expect(payload.card.enabled).toBe(true);
  });

  it('sets enabled to false when status is disabled', async () => {
    const input = createMockInput({ status: 'disabled' });
    const appendCall = input.runtimeSessionService.appendInlineCapabilityResponse;
    await handleCreateSkillIntent(input);
    const payload = appendCall.mock.calls[0][2];
    expect(payload.card.enabled).toBe(false);
  });
});

describe('handleInstallRemoteSkillIntent', () => {
  function createMockInput(overrides: Record<string, any> = {}) {
    const mockMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: 'installed',
      conversationId: 'conv-1',
      createdAt: '2026-05-11T12:00:00.000Z'
    };
    return {
      sessionId: 'sess-1',
      dto: { conversationId: 'conv-1', content: 'install skill' } as any,
      intent: { repo: 'org/repo', skillName: 'my-skill' },
      runtimeCentersService: {
        installRemoteSkill: vi.fn(async () => ({
          skillId: 'skill-1',
          skillName: 'my-skill',
          repo: 'org/repo',
          status: 'installed',
          ...overrides
        }))
      },
      runtimeSessionService: {
        appendInlineCapabilityResponse: vi.fn(async () => mockMessage)
      }
    };
  }

  it('installs remote skill and returns message', async () => {
    const input = createMockInput();
    const result = await handleInstallRemoteSkillIntent(input);
    expect(input.runtimeCentersService.installRemoteSkill).toHaveBeenCalledWith({
      repo: 'org/repo',
      skillName: 'my-skill',
      actor: 'agent-chat-user',
      triggerReason: 'user_requested',
      summary: expect.stringContaining('my-skill')
    });
    expect(result.id).toBe('msg-1');
  });

  it('handles installed status', async () => {
    const input = createMockInput({ status: 'installed' });
    await handleInstallRemoteSkillIntent(input);
    const payload = input.runtimeSessionService.appendInlineCapabilityResponse.mock.calls[0][2];
    expect(payload.content).toContain('已安装完成');
    expect(payload.card.groups[0].items[0].enabled).toBe(true);
  });

  it('handles failed status with failureCode', async () => {
    const input = createMockInput({ status: 'failed', failureCode: 'BUILD_FAILED' });
    await handleInstallRemoteSkillIntent(input);
    const payload = input.runtimeSessionService.appendInlineCapabilityResponse.mock.calls[0][2];
    expect(payload.content).toContain('安装失败');
    expect(payload.content).toContain('BUILD_FAILED');
    expect(payload.card.groups[0].items[0].blockedReason).toBe('BUILD_FAILED');
  });

  it('handles failed status without failureCode', async () => {
    const input = createMockInput({ status: 'failed' });
    await handleInstallRemoteSkillIntent(input);
    const payload = input.runtimeSessionService.appendInlineCapabilityResponse.mock.calls[0][2];
    expect(payload.content).toContain('安装失败');
  });

  it('handles pending status', async () => {
    const input = createMockInput({ status: 'pending' });
    await handleInstallRemoteSkillIntent(input);
    const payload = input.runtimeSessionService.appendInlineCapabilityResponse.mock.calls[0][2];
    expect(payload.content).toContain('pending');
    expect(payload.card.title).toContain('待审批');
  });

  it('handles rejected status', async () => {
    const input = createMockInput({ status: 'rejected' });
    await handleInstallRemoteSkillIntent(input);
    const payload = input.runtimeSessionService.appendInlineCapabilityResponse.mock.calls[0][2];
    expect(payload.content).toContain('rejected');
    expect(payload.card.title).toContain('拒绝');
  });

  it('uses intent.skillName as fallback for installName', async () => {
    const input = createMockInput({ skillName: undefined });
    await handleInstallRemoteSkillIntent(input);
    const payload = input.runtimeSessionService.appendInlineCapabilityResponse.mock.calls[0][2];
    expect(payload.content).toContain('my-skill');
  });

  it('uses intent.repo as fallback when skillName is also missing', async () => {
    const input = createMockInput({ skillName: undefined });
    input.intent.skillName = undefined;
    await handleInstallRemoteSkillIntent(input);
    const payload = input.runtimeSessionService.appendInlineCapabilityResponse.mock.calls[0][2];
    expect(payload.content).toContain('org/repo');
  });

  it('uses receipt.repo as summary fallback', async () => {
    const input = createMockInput({ repo: 'receipt/repo' });
    await handleInstallRemoteSkillIntent(input);
    const payload = input.runtimeSessionService.appendInlineCapabilityResponse.mock.calls[0][2];
    expect(payload.card.groups[0].items[0].summary).toBe('receipt/repo');
  });

  it('falls back to intent.repo when receipt.repo is missing', async () => {
    const input = createMockInput({ repo: undefined });
    await handleInstallRemoteSkillIntent(input);
    const payload = input.runtimeSessionService.appendInlineCapabilityResponse.mock.calls[0][2];
    expect(payload.card.groups[0].items[0].summary).toBe('org/repo');
  });

  it('uses receipt.skillId as item id', async () => {
    const input = createMockInput({ skillId: 'receipt-skill-1' });
    await handleInstallRemoteSkillIntent(input);
    const payload = input.runtimeSessionService.appendInlineCapabilityResponse.mock.calls[0][2];
    expect(payload.card.groups[0].items[0].id).toBe('receipt-skill-1');
  });

  it('falls back to intent.repo for item id when skillId missing', async () => {
    const input = createMockInput({ skillId: undefined });
    await handleInstallRemoteSkillIntent(input);
    const payload = input.runtimeSessionService.appendInlineCapabilityResponse.mock.calls[0][2];
    expect(payload.card.groups[0].items[0].id).toBe('org/repo');
  });
});
