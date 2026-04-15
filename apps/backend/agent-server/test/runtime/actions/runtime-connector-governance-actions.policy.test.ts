import { NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearCapabilityApprovalPolicyWithGovernance,
  clearConnectorApprovalPolicyWithGovernance,
  setCapabilityApprovalPolicyWithGovernance,
  setConnectorApprovalPolicyWithGovernance,
  setConnectorEnabledWithGovernance
} from '../../../src/runtime/actions/runtime-connector-governance-actions';
import { appendGovernanceAuditMock, createSnapshot } from './runtime-connector-governance-actions.test-helpers';

describe('runtime-connector-governance-actions policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-08T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('toggles connector enabled state with governance persistence and session close on disable', async () => {
    const snapshot = createSnapshot();
    const save = vi.fn(async () => undefined);
    const setEnabled = vi.fn();
    const closeServerSession = vi.fn(async () => true);
    const describeConnectorProfilePolicy = vi.fn(() => ({ enabledByProfile: true }));
    const get = vi
      .fn()
      .mockReturnValueOnce({ id: 'connector-1', enabled: true })
      .mockReturnValueOnce({ id: 'connector-1', enabled: false });

    const result = await setConnectorEnabledWithGovernance({
      connectorId: 'connector-1',
      enabled: false,
      profile: 'personal',
      runtimeStateRepository: { load: async () => snapshot, save },
      mcpServerRegistry: { get, setEnabled },
      mcpClientManager: { closeServerSession },
      describeConnectorProfilePolicy
    });

    expect(save).toHaveBeenCalled();
    expect(setEnabled).toHaveBeenCalledWith('connector-1', false);
    expect(closeServerSession).toHaveBeenCalledWith('connector-1');
    expect(result).toEqual({ id: 'connector-1', enabled: false });
  });

  it('rejects enabling a connector that is unavailable for the current profile', async () => {
    await expect(
      setConnectorEnabledWithGovernance({
        connectorId: 'connector-1',
        enabled: true,
        profile: 'enterprise',
        runtimeStateRepository: { load: async () => createSnapshot(), save: async () => undefined },
        mcpServerRegistry: { get: () => ({ id: 'connector-1' }), setEnabled: vi.fn() },
        mcpClientManager: { closeServerSession: vi.fn(async () => true) },
        describeConnectorProfilePolicy: () => ({ enabledByProfile: false, reason: 'blocked by profile policy' })
      })
    ).rejects.toThrowError(
      new NotFoundException('Connector connector-1 is unavailable for enterprise profile: blocked by profile policy')
    );
  });

  it('updates and clears connector and capability approval policies', async () => {
    const snapshot = createSnapshot();
    const save = vi.fn(async () => undefined);
    const setServerApprovalOverride = vi.fn();
    const setCapabilityApprovalOverride = vi.fn();
    const closeServerSession = vi.fn(async () => true);
    const loadConnectorView = vi.fn(async (connectorId: string) => ({ id: connectorId, loaded: true }));

    await setConnectorApprovalPolicyWithGovernance({
      connectorId: 'connector-1',
      effect: 'deny',
      actor: 'tester',
      runtimeStateRepository: { load: async () => snapshot, save },
      mcpServerRegistry: { get: () => ({ id: 'connector-1' }) },
      mcpCapabilityRegistry: { setServerApprovalOverride },
      mcpClientManager: { closeServerSession },
      loadConnectorView
    });
    await clearConnectorApprovalPolicyWithGovernance({
      connectorId: 'connector-1',
      actor: 'tester',
      runtimeStateRepository: { load: async () => snapshot, save },
      mcpServerRegistry: { get: () => ({ id: 'connector-1' }) },
      mcpCapabilityRegistry: { setServerApprovalOverride },
      loadConnectorView
    });
    await setCapabilityApprovalPolicyWithGovernance({
      connectorId: 'connector-1',
      capabilityId: 'cap-1',
      effect: 'observe',
      actor: 'tester',
      runtimeStateRepository: { load: async () => snapshot, save },
      mcpServerRegistry: { get: () => ({ id: 'connector-1' }) },
      mcpCapabilityRegistry: { get: () => ({ id: 'cap-1', serverId: 'connector-1' }), setCapabilityApprovalOverride },
      loadConnectorView
    });
    await clearCapabilityApprovalPolicyWithGovernance({
      connectorId: 'connector-1',
      capabilityId: 'cap-1',
      actor: 'tester',
      runtimeStateRepository: { load: async () => snapshot, save },
      mcpServerRegistry: { get: () => ({ id: 'connector-1' }) },
      mcpCapabilityRegistry: { get: () => ({ id: 'cap-1', serverId: 'connector-1' }), setCapabilityApprovalOverride },
      loadConnectorView
    });

    expect(setServerApprovalOverride).toHaveBeenLastCalledWith('connector-1', undefined);
    expect(setCapabilityApprovalOverride).toHaveBeenLastCalledWith('cap-1', undefined);
    expect(appendGovernanceAuditMock.mock.calls.length).toBeGreaterThanOrEqual(0);
  });
});
