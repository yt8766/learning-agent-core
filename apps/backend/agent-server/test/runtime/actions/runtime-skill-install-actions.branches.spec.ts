import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';

import {
  installSkillWithGovernance,
  approveSkillInstallWithGovernance,
  installRemoteSkillWithGovernance,
  rejectSkillInstallWithGovernance
} from '../../../src/runtime/actions/runtime-skill-install-actions';

const mockRepo = {
  load: vi.fn(async () => ({})),
  save: vi.fn(async () => {})
};

function makeManifest(overrides: Record<string, any> = {}) {
  return {
    id: 'manifest-1',
    name: 'Test Skill',
    description: 'A test skill',
    version: '1.0.0',
    sourceId: 'source-1',
    entry: 'index.js',
    integrity: 'sha256:abc',
    requiredCapabilities: [],
    ...overrides
  };
}

function makeSource(overrides: Record<string, any> = {}) {
  return {
    id: 'source-1',
    name: 'Test Source',
    enabled: true,
    trustClass: 'internal' as const,
    priority: 'managed/local' as const,
    discoveryMode: 'local',
    ...overrides
  };
}

function makeInput(overrides: Record<string, any> = {}) {
  return {
    dto: { manifestId: 'manifest-1', actor: 'test-user' },
    runtimeStateRepository: mockRepo,
    listSkillSources: vi.fn(async () => [makeSource()]),
    listSkillManifests: vi.fn(async () => [makeManifest()]),
    evaluateSkillManifestSafety: vi.fn(() => ({ verdict: 'allow' as const })),
    writeSkillInstallReceipt: vi.fn(async () => {}),
    finalizeSkillInstall: vi.fn(async () => {}),
    ...overrides
  };
}

describe('installSkillWithGovernance', () => {
  it('throws when manifest not found', async () => {
    const input = makeInput({ listSkillManifests: vi.fn(async () => []) });
    await expect(installSkillWithGovernance(input)).rejects.toThrow(NotFoundException);
  });

  it('throws when source not found', async () => {
    const input = makeInput({ listSkillSources: vi.fn(async () => []) });
    await expect(installSkillWithGovernance(input)).rejects.toThrow(NotFoundException);
  });

  it('throws when source is disabled', async () => {
    const input = makeInput({ listSkillSources: vi.fn(async () => [makeSource({ enabled: false })]) });
    await expect(installSkillWithGovernance(input)).rejects.toThrow(NotFoundException);
  });

  it('throws when safety verdict is blocked', async () => {
    const input = makeInput({
      evaluateSkillManifestSafety: vi.fn(() => ({ verdict: 'blocked' as const }))
    });
    await expect(installSkillWithGovernance(input)).rejects.toThrow(NotFoundException);
  });

  it('installs directly when verdict is allow and source is internal', async () => {
    const input = makeInput();
    const receipt = await installSkillWithGovernance(input);
    expect(receipt.status).toBe('installed');
    expect(receipt.phase).toBe('approved');
    expect(receipt.approvedBy).toBe('test-user');
    expect(input.finalizeSkillInstall).toHaveBeenCalled();
  });

  it('requires approval when verdict is needs-approval', async () => {
    const input = makeInput({
      evaluateSkillManifestSafety: vi.fn(() => ({ verdict: 'needs-approval' as const }))
    });
    const receipt = await installSkillWithGovernance(input);
    expect(receipt.status).toBe('pending');
    expect(receipt.phase).toBe('requested');
    expect(receipt.approvedBy).toBeUndefined();
    expect(input.finalizeSkillInstall).not.toHaveBeenCalled();
  });

  it('requires approval when trustClass is community', async () => {
    const input = makeInput({
      listSkillSources: vi.fn(async () => [makeSource({ trustClass: 'community' })])
    });
    const receipt = await installSkillWithGovernance(input);
    expect(receipt.status).toBe('pending');
  });

  it('requires approval when trustClass is unverified', async () => {
    const input = makeInput({
      listSkillSources: vi.fn(async () => [makeSource({ trustClass: 'unverified' })])
    });
    const receipt = await installSkillWithGovernance(input);
    expect(receipt.status).toBe('pending');
  });

  it('uses dto.sourceId when provided', async () => {
    const input = makeInput({ dto: { manifestId: 'manifest-1', sourceId: 'source-1', actor: 'test-user' } });
    const receipt = await installSkillWithGovernance(input);
    expect(receipt).toBeDefined();
  });

  it('falls back to system actor when dto.actor is missing', async () => {
    const input = makeInput({ dto: { manifestId: 'manifest-1' } });
    const receipt = await installSkillWithGovernance(input);
    expect(receipt.approvedBy).toBe('system');
  });

  it('extracts workspaceDraftId from metadata.draftId', async () => {
    const manifest = makeManifest({ sourceId: 'workspace-skill-drafts', metadata: { draftId: 'draft-123' } });
    const input = makeInput({
      listSkillManifests: vi.fn(async () => [manifest]),
      listSkillSources: vi.fn(async () => [makeSource({ id: 'workspace-skill-drafts' })])
    });
    const receipt = await installSkillWithGovernance(input);
    expect(receipt.sourceDraftId).toBe('draft-123');
  });

  it('extracts workspaceDraftId from entry prefix', async () => {
    const manifest = makeManifest({
      sourceId: 'workspace-skill-drafts',
      entry: 'workspace-draft:my-draft',
      metadata: {}
    });
    const input = makeInput({
      listSkillManifests: vi.fn(async () => [manifest]),
      listSkillSources: vi.fn(async () => [makeSource({ id: 'workspace-skill-drafts' })])
    });
    const receipt = await installSkillWithGovernance(input);
    expect(receipt.sourceDraftId).toBe('my-draft');
  });

  it('returns undefined for sourceDraftId when sourceId is not workspace-skill-drafts', async () => {
    const input = makeInput();
    const receipt = await installSkillWithGovernance(input);
    expect(receipt.sourceDraftId).toBeUndefined();
  });
});

describe('approveSkillInstallWithGovernance', () => {
  function makeApproveInput(overrides: Record<string, any> = {}) {
    return {
      receiptId: 'receipt-1',
      dto: { actor: 'admin-user' },
      runtimeStateRepository: mockRepo,
      getSkillInstallReceipt: vi.fn(async () => ({
        id: 'receipt-1',
        skillId: 'manifest-1',
        version: '1.0.0',
        sourceId: 'source-1',
        phase: 'requested',
        status: 'pending',
        result: 'waiting_for_install_approval',
        integrity: 'sha256:abc'
      })),
      listSkillSources: vi.fn(async () => [makeSource()]),
      listSkillManifests: vi.fn(async () => [makeManifest()]),
      writeSkillInstallReceipt: vi.fn(async () => {}),
      finalizeSkillInstall: vi.fn(async () => {}),
      finalizeRemoteSkillInstall: vi.fn(async () => {}),
      ...overrides
    };
  }

  it('returns receipt immediately if already installed', async () => {
    const input = makeApproveInput({
      getSkillInstallReceipt: vi.fn(async () => ({
        id: 'receipt-1',
        skillId: 'm1',
        version: '1.0',
        sourceId: 's1',
        phase: 'approved',
        status: 'installed',
        result: 'installed_to_lab',
        integrity: 'sha256:x'
      }))
    });
    const result = await approveSkillInstallWithGovernance(input);
    expect(result.status).toBe('installed');
  });

  it('throws when source not found', async () => {
    const input = makeApproveInput({ listSkillSources: vi.fn(async () => []) });
    await expect(approveSkillInstallWithGovernance(input)).rejects.toThrow(NotFoundException);
  });

  it('throws when manifest not found and receipt has no repo', async () => {
    const input = makeApproveInput({ listSkillManifests: vi.fn(async () => []) });
    await expect(approveSkillInstallWithGovernance(input)).rejects.toThrow(NotFoundException);
  });

  it('approves and finalizes local install', async () => {
    const input = makeApproveInput();
    const result = await approveSkillInstallWithGovernance(input);
    expect(input.writeSkillInstallReceipt).toHaveBeenCalled();
    expect(input.finalizeSkillInstall).toHaveBeenCalled();
  });

  it('approves remote install when receipt has repo', async () => {
    const input = makeApproveInput({
      getSkillInstallReceipt: vi.fn(async () => ({
        id: 'receipt-1',
        skillId: 'm1',
        version: '1.0',
        sourceId: 'source-1',
        phase: 'requested',
        status: 'pending',
        result: 'waiting_for_install_approval',
        integrity: 'sha256:x',
        repo: 'org/repo'
      }))
    });
    const result = await approveSkillInstallWithGovernance(input);
    expect(input.finalizeRemoteSkillInstall).toHaveBeenCalled();
  });

  it('handles finalize failure gracefully', async () => {
    const input = makeApproveInput({
      finalizeSkillInstall: vi.fn(async () => {
        throw new Error('install failed');
      })
    });
    const result = await approveSkillInstallWithGovernance(input);
    expect(result).toBeDefined();
  });

  it('handles remote finalize failure gracefully', async () => {
    const input = makeApproveInput({
      getSkillInstallReceipt: vi.fn(async () => ({
        id: 'receipt-1',
        skillId: 'm1',
        version: '1.0',
        sourceId: 'source-1',
        phase: 'requested',
        status: 'pending',
        result: 'waiting_for_install_approval',
        integrity: 'sha256:x',
        repo: 'org/repo'
      })),
      finalizeRemoteSkillInstall: vi.fn(async () => {
        throw new Error('remote failed');
      })
    });
    const result = await approveSkillInstallWithGovernance(input);
    expect(result).toBeDefined();
  });
});

describe('installRemoteSkillWithGovernance', () => {
  function makeRemoteInput(overrides: Record<string, any> = {}) {
    return {
      dto: { repo: 'org/repo', actor: 'agent-chat-user' },
      runtimeStateRepository: mockRepo,
      listSkillSources: vi.fn(async () => [makeSource({ id: 'skills-sh-directory', trustClass: 'internal' })]),
      writeSkillInstallReceipt: vi.fn(async () => {}),
      finalizeRemoteSkillInstall: vi.fn(async () => {}),
      ...overrides
    };
  }

  it('throws when skills-sh-directory source not found', async () => {
    const input = makeRemoteInput({ listSkillSources: vi.fn(async () => []) });
    await expect(installRemoteSkillWithGovernance(input)).rejects.toThrow(NotFoundException);
  });

  it('throws when skills-sh-directory source is disabled', async () => {
    const input = makeRemoteInput({
      listSkillSources: vi.fn(async () => [makeSource({ id: 'skills-sh-directory', enabled: false })])
    });
    await expect(installRemoteSkillWithGovernance(input)).rejects.toThrow(NotFoundException);
  });

  it('installs directly when actor is agent-chat-user and trustClass is internal', async () => {
    const input = makeRemoteInput();
    const receipt = await installRemoteSkillWithGovernance(input);
    expect(receipt.status).toBe('approved');
    expect(receipt.approvedBy).toBe('agent-chat-user');
    expect(input.finalizeRemoteSkillInstall).toHaveBeenCalled();
  });

  it('requires approval when actor is not agent-chat-user and trustClass is not internal', async () => {
    const input = makeRemoteInput({
      dto: { repo: 'org/repo', actor: 'admin-user' },
      listSkillSources: vi.fn(async () => [makeSource({ id: 'skills-sh-directory', trustClass: 'community' })])
    });
    const receipt = await installRemoteSkillWithGovernance(input);
    expect(receipt.status).toBe('pending');
    expect(input.finalizeRemoteSkillInstall).not.toHaveBeenCalled();
  });

  it('requires approval when trustClass is not internal and actor is not agent-chat-user', async () => {
    const input = makeRemoteInput({
      dto: { repo: 'org/repo', actor: 'admin-user' },
      listSkillSources: vi.fn(async () => [makeSource({ id: 'skills-sh-directory', trustClass: 'community' })])
    });
    const receipt = await installRemoteSkillWithGovernance(input);
    expect(receipt.status).toBe('pending');
  });

  it('handles finalize failure for auto-approved remote install', async () => {
    const input = makeRemoteInput({
      finalizeRemoteSkillInstall: vi.fn(async () => {
        throw new Error('fail');
      })
    });
    const receipt = await installRemoteSkillWithGovernance(input);
    expect(receipt.status).toBe('approved');
  });

  it('uses explicit skillName when provided', async () => {
    const input = makeRemoteInput({ dto: { repo: 'org/repo', skillName: 'my-skill', actor: 'agent-chat-user' } });
    const receipt = await installRemoteSkillWithGovernance(input);
    expect(receipt.skillName).toBe('my-skill');
    expect(receipt.skillId).toContain('my-skill');
  });

  it('generates skillId without skillName', async () => {
    const input = makeRemoteInput({ dto: { repo: 'org/repo', actor: 'agent-chat-user' } });
    const receipt = await installRemoteSkillWithGovernance(input);
    expect(receipt.skillId).toBe('remote-org-repo');
  });

  it('falls back to system actor when dto.actor is missing and auto-approved', async () => {
    const input = makeRemoteInput({ dto: { repo: 'org/repo' } });
    const receipt = await installRemoteSkillWithGovernance(input);
    // With trustClass='internal' and actor undefined, requiresApproval = false (internal),
    // so it auto-approves with actor fallback 'system'
    expect(receipt.approvedBy).toBe('system');
  });

  it('includes optional fields from dto', async () => {
    const input = makeRemoteInput({
      dto: {
        repo: 'org/repo',
        actor: 'agent-chat-user',
        summary: 'Install this skill',
        detailsUrl: 'https://example.com',
        installCommand: 'custom-install',
        triggerReason: 'user-requested'
      }
    });
    const receipt = await installRemoteSkillWithGovernance(input);
    expect(receipt.reason).toBe('Install this skill');
    expect(receipt.detailsUrl).toBe('https://example.com');
    expect(receipt.installCommand).toBe('custom-install');
    expect(receipt.triggerReason).toBe('user-requested');
  });
});

describe('rejectSkillInstallWithGovernance', () => {
  it('rejects receipt with reason', async () => {
    const input = {
      receiptId: 'receipt-1',
      dto: { actor: 'admin', reason: 'Not safe' },
      runtimeStateRepository: mockRepo,
      getSkillInstallReceipt: vi.fn(async () => ({
        id: 'receipt-1',
        skillId: 'manifest-1',
        version: '1.0',
        sourceId: 's1',
        phase: 'requested',
        status: 'pending',
        result: 'waiting_for_install_approval',
        integrity: 'sha256:x'
      })),
      writeSkillInstallReceipt: vi.fn(async () => {})
    };
    const result = await rejectSkillInstallWithGovernance(input);
    expect(result.status).toBe('rejected');
    expect(result.phase).toBe('failed');
    expect(result.rejectedBy).toBe('admin');
    expect(result.reason).toBe('Not safe');
    expect(result.result).toBe('Not safe');
  });

  it('uses default actor and result when not provided', async () => {
    const input = {
      receiptId: 'receipt-1',
      dto: {},
      runtimeStateRepository: mockRepo,
      getSkillInstallReceipt: vi.fn(async () => ({
        id: 'receipt-1',
        skillId: 'manifest-1',
        version: '1.0',
        sourceId: 's1',
        phase: 'requested',
        status: 'pending',
        result: 'waiting_for_install_approval',
        integrity: 'sha256:x'
      })),
      writeSkillInstallReceipt: vi.fn(async () => {})
    };
    const result = await rejectSkillInstallWithGovernance(input);
    expect(result.rejectedBy).toBe('agent-admin-user');
    expect(result.result).toBe('install_rejected');
  });
});
