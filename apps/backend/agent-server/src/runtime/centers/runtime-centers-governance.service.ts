import {
  ConfigureConnectorDto,
  InstallRemoteSkillDto,
  InstallSkillDto,
  ResolveSkillInstallDto,
  SkillManifestRecord,
  SkillSourceRecord
} from '@agent/core';
import { NotFoundException } from '@nestjs/common';
import { appendGovernanceAudit } from '@agent/runtime';
import {
  clearCapabilityApprovalPolicyWithGovernance,
  clearConnectorApprovalPolicyWithGovernance,
  closeConnectorSessionWithGovernance,
  configureConnectorWithGovernance,
  refreshConnectorDiscoveryWithGovernance,
  setCapabilityApprovalPolicyWithGovernance,
  setConnectorApprovalPolicyWithGovernance,
  setConnectorEnabledWithGovernance
} from '../actions/runtime-connector-governance-actions';
import {
  approveSkillInstallWithGovernance,
  installSkillWithGovernance,
  installRemoteSkillWithGovernance,
  rejectSkillInstallWithGovernance
} from '../actions/runtime-skill-install-actions';
import { registerConfiguredConnector, registerDiscoveredCapabilities } from '../helpers/runtime-connector-registry';
import {
  getCounselorSelectorConfigs as getCounselorSelectorConfigsWithPolicy,
  listApprovalScopePolicies as listApprovalScopePoliciesWithPolicy,
  revokeApprovalScopePolicy as revokeApprovalScopePolicyWithPolicy,
  setCounselorSelectorEnabled as setCounselorSelectorEnabledWithPolicy,
  setLearningConflictStatus as setLearningConflictStatusWithPolicy,
  upsertCounselorSelectorConfig as upsertCounselorSelectorConfigWithPolicy
} from './runtime-centers-governance-policy';
import { refreshMetricsSnapshots as refreshMetricsSnapshotsWithGovernance } from './runtime-centers-governance-metrics';
import {
  checkInstalledSkills,
  getSkillInstallReceipt,
  updateInstalledSkills
} from '../skills/runtime-skill-install.service';
import { listSkillManifests, listSkillSources } from '../skills/runtime-skill-sources.service';
import { RuntimeCentersContext } from './runtime-centers.types';
import { loadConnectorView } from './runtime-centers-governance-connectors';
import {
  setCompanyWorkerEnabledWithGovernance,
  setSkillSourceEnabledWithGovernance,
  syncSkillSourceWithGovernance
} from '../domain/governance/runtime-governance-actions';
import { loadCompanyAgentView } from '../domain/governance/runtime-company-agents-view';
import {
  createApproveSkillInstallGovernanceContext,
  createInstallRemoteSkillGovernanceContext,
  createInstallSkillGovernanceContext,
  createRejectSkillInstallGovernanceContext
} from '../domain/skills/runtime-skill-governance-context';
import { getRuntimeWorkspaceDraftStoreForContext } from './runtime-centers-workspace-drafts';

export class RuntimeCentersGovernanceService {
  constructor(private readonly getContext: () => RuntimeCentersContext) {}

  async listApprovalScopePolicies() {
    return listApprovalScopePoliciesWithPolicy(this.ctx());
  }

  async revokeApprovalScopePolicy(policyId: string) {
    return revokeApprovalScopePolicyWithPolicy(this.ctx(), policyId);
  }

  async getCounselorSelectorConfigs() {
    return getCounselorSelectorConfigsWithPolicy(this.ctx());
  }

  async upsertCounselorSelectorConfig(input: Parameters<typeof upsertCounselorSelectorConfigWithPolicy>[1]) {
    return upsertCounselorSelectorConfigWithPolicy(this.ctx(), input);
  }

  async setCounselorSelectorEnabled(selectorId: string, enabled: boolean) {
    return setCounselorSelectorEnabledWithPolicy(this.ctx(), selectorId, enabled);
  }

  async setLearningConflictStatus(
    conflictId: string,
    status: 'open' | 'merged' | 'dismissed' | 'escalated',
    preferredMemoryId?: string
  ) {
    return setLearningConflictStatusWithPolicy(this.ctx(), conflictId, status, preferredMemoryId);
  }

  async syncSkillSource(sourceId: string) {
    const ctx = this.ctx();
    return syncSkillSourceWithGovernance({
      sourceId,
      runtimeStateRepository: ctx.runtimeStateRepository,
      listSkillSources: () => listSkillSources(ctx.getSkillSourcesContext()),
      skillSourceSyncService: {
        syncSource: source => ctx.getSkillSourcesContext().skillSourceSyncService.syncSource(source)
      }
    });
  }

  async installSkill(dto: InstallSkillDto) {
    const ctx = this.ctx();
    return installSkillWithGovernance(createInstallSkillGovernanceContext(ctx, dto));
  }

  async installRemoteSkill(dto: InstallRemoteSkillDto) {
    const ctx = this.ctx();
    return installRemoteSkillWithGovernance(createInstallRemoteSkillGovernanceContext(ctx, dto));
  }

  async checkInstalledSkills() {
    const ctx = this.ctx();
    const result = await checkInstalledSkills(ctx.getSkillInstallContext());
    await appendGovernanceAudit(ctx.runtimeStateRepository, {
      actor: 'agent-admin-user',
      action: 'skill.installation.checked',
      scope: 'skill-install',
      targetId: 'installed-skills',
      outcome: 'success',
      reason: result.stdout.trim() || 'skills check'
    });
    return result;
  }

  async updateInstalledSkills() {
    const ctx = this.ctx();
    const result = await updateInstalledSkills(ctx.getSkillInstallContext());
    await appendGovernanceAudit(ctx.runtimeStateRepository, {
      actor: 'agent-admin-user',
      action: 'skill.installation.updated',
      scope: 'skill-install',
      targetId: 'installed-skills',
      outcome: 'success',
      reason: result.stdout.trim() || 'skills update'
    });
    return result;
  }

  async getSkillInstallReceipt(receiptId: string) {
    const ctx = this.ctx();
    return getSkillInstallReceipt(ctx.getSkillInstallContext(), receiptId);
  }

  async approveSkillInstall(receiptId: string, dto: ResolveSkillInstallDto) {
    const ctx = this.ctx();
    return approveSkillInstallWithGovernance(createApproveSkillInstallGovernanceContext(ctx, receiptId, dto));
  }

  async rejectSkillInstall(receiptId: string, dto: ResolveSkillInstallDto) {
    const ctx = this.ctx();
    return rejectSkillInstallWithGovernance(createRejectSkillInstallGovernanceContext(ctx, receiptId, dto));
  }

  async approveWorkspaceSkillDraft(draftId: string, dto?: Record<string, unknown>) {
    const ctx = this.ctx();
    try {
      return await getRuntimeWorkspaceDraftStoreForContext(ctx).approveDraftForInstallCandidate(draftId, {
        reviewerId: getWorkspaceDraftReviewerId(dto)
      });
    } catch (error) {
      throwWorkspaceDraftNotFound(draftId, error);
      throw error;
    }
  }

  async rejectWorkspaceSkillDraft(draftId: string, dto?: Record<string, unknown>) {
    const ctx = this.ctx();
    try {
      return await getRuntimeWorkspaceDraftStoreForContext(ctx).rejectDraft(draftId, {
        reviewerId: getWorkspaceDraftReviewerId(dto),
        reason: typeof dto?.reason === 'string' ? dto.reason : undefined
      });
    } catch (error) {
      throwWorkspaceDraftNotFound(draftId, error);
      throw error;
    }
  }

  async setSkillSourceEnabled(sourceId: string, enabled: boolean) {
    const ctx = this.ctx();
    return setSkillSourceEnabledWithGovernance({
      sourceId,
      enabled,
      runtimeStateRepository: ctx.runtimeStateRepository,
      listSkillSources: () => listSkillSources(ctx.getSkillSourcesContext())
    });
  }

  async setCompanyAgentEnabled(workerId: string, enabled: boolean) {
    const ctx = this.ctx();
    return setCompanyWorkerEnabledWithGovernance({
      workerId,
      enabled,
      runtimeStateRepository: ctx.runtimeStateRepository,
      orchestrator: ctx.orchestrator,
      loadCompanyWorkerView: async id => (await loadCompanyAgentView(ctx, id))!
    });
  }

  async setConnectorEnabled(connectorId: string, enabled: boolean) {
    const ctx = this.ctx();
    return setConnectorEnabledWithGovernance({
      connectorId,
      enabled,
      profile: ctx.settings.profile,
      runtimeStateRepository: ctx.runtimeStateRepository,
      mcpServerRegistry: ctx.mcpServerRegistry,
      mcpClientManager: ctx.mcpClientManager,
      describeConnectorProfilePolicy: ctx.describeConnectorProfilePolicy
    });
  }

  async setConnectorApprovalPolicy(
    connectorId: string,
    effect: 'allow' | 'deny' | 'require-approval' | 'observe',
    actor = 'agent-admin-user'
  ) {
    const ctx = this.ctx();
    return setConnectorApprovalPolicyWithGovernance({
      connectorId,
      effect,
      actor,
      runtimeStateRepository: ctx.runtimeStateRepository,
      mcpServerRegistry: ctx.mcpServerRegistry,
      mcpCapabilityRegistry: ctx.mcpCapabilityRegistry,
      mcpClientManager: ctx.mcpClientManager,
      loadConnectorView: (id: string) => loadConnectorView(ctx, id)
    });
  }

  async clearConnectorApprovalPolicy(connectorId: string, actor = 'agent-admin-user') {
    const ctx = this.ctx();
    return clearConnectorApprovalPolicyWithGovernance({
      connectorId,
      actor,
      runtimeStateRepository: ctx.runtimeStateRepository,
      mcpServerRegistry: ctx.mcpServerRegistry,
      mcpCapabilityRegistry: ctx.mcpCapabilityRegistry,
      loadConnectorView: (id: string) => loadConnectorView(ctx, id)
    });
  }

  async setCapabilityApprovalPolicy(
    connectorId: string,
    capabilityId: string,
    effect: 'allow' | 'deny' | 'require-approval' | 'observe',
    actor = 'agent-admin-user'
  ) {
    const ctx = this.ctx();
    return setCapabilityApprovalPolicyWithGovernance({
      connectorId,
      capabilityId,
      effect,
      actor,
      runtimeStateRepository: ctx.runtimeStateRepository,
      mcpServerRegistry: ctx.mcpServerRegistry,
      mcpCapabilityRegistry: ctx.mcpCapabilityRegistry,
      loadConnectorView: (id: string) => loadConnectorView(ctx, id)
    });
  }

  async clearCapabilityApprovalPolicy(connectorId: string, capabilityId: string, actor = 'agent-admin-user') {
    const ctx = this.ctx();
    return clearCapabilityApprovalPolicyWithGovernance({
      connectorId,
      capabilityId,
      actor,
      runtimeStateRepository: ctx.runtimeStateRepository,
      mcpServerRegistry: ctx.mcpServerRegistry,
      mcpCapabilityRegistry: ctx.mcpCapabilityRegistry,
      loadConnectorView: (id: string) => loadConnectorView(ctx, id)
    });
  }

  async closeConnectorSession(connectorId: string) {
    const ctx = this.ctx();
    return closeConnectorSessionWithGovernance({
      connectorId,
      runtimeStateRepository: ctx.runtimeStateRepository,
      mcpClientManager: ctx.mcpClientManager
    });
  }

  async refreshConnectorDiscovery(connectorId: string) {
    const ctx = this.ctx();
    return refreshConnectorDiscoveryWithGovernance({
      connectorId,
      runtimeStateRepository: ctx.runtimeStateRepository,
      mcpServerRegistry: ctx.mcpServerRegistry,
      mcpClientManager: ctx.mcpClientManager,
      registerDiscoveredCapabilities: (id: string) =>
        registerDiscoveredCapabilities(ctx.getConnectorRegistryContext(), id),
      loadConnectorView: (id: string) => loadConnectorView(ctx, id)
    });
  }

  async configureConnector(dto: ConfigureConnectorDto) {
    const ctx = this.ctx();
    return configureConnectorWithGovernance({
      dto,
      runtimeStateRepository: ctx.runtimeStateRepository,
      mcpClientManager: ctx.mcpClientManager,
      registerConfiguredConnector: config => registerConfiguredConnector(ctx.getConnectorRegistryContext(), config),
      registerDiscoveredCapabilities: (id: string) =>
        registerDiscoveredCapabilities(ctx.getConnectorRegistryContext(), id),
      loadConnectorView: (id: string) => loadConnectorView(ctx, id)
    });
  }

  async refreshMetricsSnapshots(days = 30) {
    return refreshMetricsSnapshotsWithGovernance(this.ctx(), days);
  }

  private ctx() {
    return this.getContext();
  }
}

function getWorkspaceDraftReviewerId(dto?: Record<string, unknown>): string {
  return typeof dto?.reviewerId === 'string' ? dto.reviewerId : 'agent-admin-user';
}

function throwWorkspaceDraftNotFound(draftId: string, error: unknown): void {
  if (error instanceof Error && error.message === `Skill draft ${draftId} not found`) {
    throw new NotFoundException(`Workspace skill draft ${draftId} not found`);
  }
}
