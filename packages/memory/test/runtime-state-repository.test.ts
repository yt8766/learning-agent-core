import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  tasksStateFilePath: ''
}));

vi.mock('@agent/config', () => ({
  loadSettings: () => ({
    tasksStateFilePath: mocked.tasksStateFilePath
  })
}));

describe('FileRuntimeStateRepository', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agent-runtime-state-'));
    mocked.tasksStateFilePath = join(tempDir, 'runtime', 'tasks-state.json');
    vi.resetModules();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('在文件不存在时返回空快照', async () => {
    const { FileRuntimeStateRepository } = await import('../src/repositories/runtime-state-repository');
    const repository = new FileRuntimeStateRepository();

    await expect(repository.load()).resolves.toEqual({
      tasks: [],
      learningJobs: [],
      learningQueue: [],
      pendingExecutions: [],
      channelDeliveries: [],
      chatSessions: [],
      chatMessages: [],
      chatEvents: [],
      chatCheckpoints: [],
      crossCheckEvidence: [],
      governance: {
        disabledSkillSourceIds: [],
        disabledCompanyWorkerIds: [],
        disabledConnectorIds: [],
        configuredConnectors: [],
        connectorDiscoveryHistory: [],
        connectorPolicyOverrides: [],
        capabilityPolicyOverrides: [],
        capabilityGovernanceProfiles: [],
        ministryGovernanceProfiles: [],
        specialistGovernanceProfiles: [],
        workerGovernanceProfiles: [],
        counselorSelectorConfigs: [],
        approvalScopePolicies: [],
        learningConflictScan: {
          scannedAt: '',
          conflictPairs: [],
          mergeSuggestions: [],
          manualReviewQueue: []
        }
      },
      governanceAudit: [],
      usageHistory: [],
      evalHistory: [],
      usageAudit: []
    });
  });

  it('保存后可以完整读回快照', async () => {
    const { FileRuntimeStateRepository } = await import('../src/repositories/runtime-state-repository');
    const repository = new FileRuntimeStateRepository();
    const snapshot = {
      tasks: [
        {
          id: 'task-1',
          goal: 'demo',
          status: 'completed',
          trace: [],
          approvals: [],
          agentStates: [],
          messages: [],
          createdAt: '2026-03-22T00:00:00.000Z',
          updatedAt: '2026-03-22T00:00:00.000Z'
        }
      ],
      learningJobs: [],
      learningQueue: [],
      pendingExecutions: [],
      channelDeliveries: [],
      chatSessions: [],
      chatMessages: [],
      chatEvents: [],
      chatCheckpoints: [],
      crossCheckEvidence: [],
      governance: {
        disabledSkillSourceIds: [],
        disabledCompanyWorkerIds: [],
        disabledConnectorIds: [],
        configuredConnectors: [],
        connectorDiscoveryHistory: [],
        connectorPolicyOverrides: [],
        capabilityPolicyOverrides: [],
        capabilityGovernanceProfiles: [],
        ministryGovernanceProfiles: [],
        specialistGovernanceProfiles: [],
        workerGovernanceProfiles: [],
        counselorSelectorConfigs: [],
        approvalScopePolicies: [],
        learningConflictScan: {
          scannedAt: '',
          conflictPairs: [],
          mergeSuggestions: [],
          manualReviewQueue: []
        }
      },
      governanceAudit: [],
      usageHistory: [],
      evalHistory: [],
      usageAudit: []
    };

    await repository.save(snapshot as any);

    await expect(repository.load()).resolves.toEqual(snapshot);
  });

  it('保留任务快照中的运行态 overlay 字段', async () => {
    const { FileRuntimeStateRepository } = await import('../src/repositories/runtime-state-repository');
    const repository = new FileRuntimeStateRepository();
    const snapshot = {
      tasks: [
        {
          id: 'task-overlay',
          goal: 'keep runtime overlay fields',
          status: 'waiting_approval',
          trace: [],
          approvals: [],
          agentStates: [],
          messages: [],
          activeInterrupt: {
            id: 'interrupt-1',
            status: 'pending',
            mode: 'blocking',
            source: 'graph',
            origin: 'runtime',
            kind: 'user-input',
            interactionKind: 'supplemental-input',
            requestedBy: 'libu-governance',
            reason: 'budget confirmation required',
            createdAt: '2026-04-17T00:00:00.000Z'
          },
          interruptHistory: [
            {
              id: 'interrupt-1',
              status: 'pending',
              mode: 'blocking',
              source: 'graph',
              origin: 'runtime',
              kind: 'user-input',
              interactionKind: 'supplemental-input',
              requestedBy: 'libu-governance',
              reason: 'budget confirmation required',
              createdAt: '2026-04-17T00:00:00.000Z'
            }
          ],
          createdAt: '2026-04-17T00:00:00.000Z',
          updatedAt: '2026-04-17T00:00:00.000Z'
        }
      ],
      learningJobs: [],
      learningQueue: [],
      pendingExecutions: [],
      channelDeliveries: [],
      chatSessions: [],
      chatMessages: [],
      chatEvents: [],
      chatCheckpoints: [],
      crossCheckEvidence: [],
      governance: {
        disabledSkillSourceIds: [],
        disabledCompanyWorkerIds: [],
        disabledConnectorIds: [],
        configuredConnectors: [],
        connectorDiscoveryHistory: [],
        connectorPolicyOverrides: [],
        capabilityPolicyOverrides: [],
        capabilityGovernanceProfiles: [],
        ministryGovernanceProfiles: [],
        specialistGovernanceProfiles: [],
        workerGovernanceProfiles: [],
        counselorSelectorConfigs: [],
        approvalScopePolicies: [],
        learningConflictScan: {
          scannedAt: '',
          conflictPairs: [],
          mergeSuggestions: [],
          manualReviewQueue: []
        }
      },
      governanceAudit: [],
      usageHistory: [],
      evalHistory: [],
      usageAudit: []
    };

    await repository.save(snapshot as any);

    const loaded = await repository.load();

    expect(loaded.tasks[0]?.activeInterrupt?.id).toBe('interrupt-1');
    expect(loaded.tasks[0]?.interruptHistory).toHaveLength(1);
  });
});
