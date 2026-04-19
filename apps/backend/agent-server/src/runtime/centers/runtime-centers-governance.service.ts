import { NotFoundException } from '@nestjs/common';
import {
  ConfigureConnectorDto,
  InstallRemoteSkillDto,
  InstallSkillDto,
  ResolveSkillInstallDto,
  SkillManifestRecord,
  SkillSourceRecord
} from '@agent/core';
import { appendGovernanceAudit } from '@agent/runtime';
import { buildCompanyAgentsCenter } from './runtime-company-agents-center';
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
import {
  getDisabledCompanyWorkerIds,
  registerConfiguredConnector,
  registerDiscoveredCapabilities
} from '../helpers/runtime-connector-registry';
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
  finalizeRemoteSkillInstall,
  finalizeSkillInstall,
  getSkillInstallReceipt,
  updateInstalledSkills,
  writeSkillInstallReceipt
} from '../skills/runtime-skill-install.service';
import { listSkillManifests, listSkillSources } from '../skills/runtime-skill-sources.service';
import { evaluateSkillManifestSafety } from '../skills/runtime-skill-safety';
import { RuntimeCentersContext } from './runtime-centers.types';
import { loadConnectorView } from './runtime-centers-governance-connectors';

interface CompanyWorkerRecord {
  id: string;
  kind?: string;
}

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
    const source = (await listSkillSources(ctx.getSkillSourcesContext())).find(
      (item: SkillSourceRecord) => item.id === sourceId
    );
    if (!source) {
      throw new NotFoundException(`Skill source ${sourceId} not found`);
    }
    const result = await ctx.getSkillSourcesContext().skillSourceSyncService.syncSource(source);
    await appendGovernanceAudit(ctx.runtimeStateRepository, {
      actor: 'agent-admin-user',
      action: 'skill-source.synced',
      scope: 'skill-source',
      targetId: sourceId,
      outcome: result.status === 'failed' ? 'rejected' : 'success',
      reason: result.error ?? `manifestCount=${result.manifestCount}`
    });
    return (await listSkillSources(ctx.getSkillSourcesContext())).find(
      (item: SkillSourceRecord) => item.id === sourceId
    )!;
  }

  async installSkill(dto: InstallSkillDto) {
    const ctx = this.ctx();
    return installSkillWithGovernance({
      dto,
      runtimeStateRepository: ctx.runtimeStateRepository,
      listSkillSources: () => listSkillSources(ctx.getSkillSourcesContext()),
      listSkillManifests: () => listSkillManifests(ctx.getSkillSourcesContext()),
      evaluateSkillManifestSafety: (manifest: SkillManifestRecord, source: SkillSourceRecord | undefined) =>
        evaluateSkillManifestSafety(ctx.getSkillSourcesContext(), manifest, source),
      writeSkillInstallReceipt: receipt => writeSkillInstallReceipt(ctx.getSkillInstallContext(), receipt),
      finalizeSkillInstall: async (manifest, source, receipt) => {
        await finalizeSkillInstall(ctx.getSkillInstallContext(), manifest, source, receipt);
      }
    });
  }

  async installRemoteSkill(dto: InstallRemoteSkillDto) {
    const ctx = this.ctx();
    return installRemoteSkillWithGovernance({
      dto,
      runtimeStateRepository: ctx.runtimeStateRepository,
      listSkillSources: () => listSkillSources(ctx.getSkillSourcesContext()),
      writeSkillInstallReceipt: receipt => writeSkillInstallReceipt(ctx.getSkillInstallContext(), receipt),
      finalizeRemoteSkillInstall: async receipt => {
        await finalizeRemoteSkillInstall(ctx.getSkillInstallContext(), receipt);
      }
    });
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
    return approveSkillInstallWithGovernance({
      receiptId,
      dto,
      runtimeStateRepository: ctx.runtimeStateRepository,
      getSkillInstallReceipt: (id: string) => getSkillInstallReceipt(ctx.getSkillInstallContext(), id),
      listSkillSources: () => listSkillSources(ctx.getSkillSourcesContext()),
      listSkillManifests: () => listSkillManifests(ctx.getSkillSourcesContext()),
      writeSkillInstallReceipt: receipt => writeSkillInstallReceipt(ctx.getSkillInstallContext(), receipt),
      finalizeSkillInstall: async (manifest, source, receipt) => {
        await finalizeSkillInstall(ctx.getSkillInstallContext(), manifest, source, receipt);
      },
      finalizeRemoteSkillInstall: async receipt => {
        await finalizeRemoteSkillInstall(ctx.getSkillInstallContext(), receipt);
      }
    });
  }

  async rejectSkillInstall(receiptId: string, dto: ResolveSkillInstallDto) {
    const ctx = this.ctx();
    return rejectSkillInstallWithGovernance({
      receiptId,
      dto,
      runtimeStateRepository: ctx.runtimeStateRepository,
      getSkillInstallReceipt: (id: string) => getSkillInstallReceipt(ctx.getSkillInstallContext(), id),
      writeSkillInstallReceipt: receipt => writeSkillInstallReceipt(ctx.getSkillInstallContext(), receipt)
    });
  }

  async setSkillSourceEnabled(sourceId: string, enabled: boolean) {
    const ctx = this.ctx();
    const sources = await listSkillSources(ctx.getSkillSourcesContext());
    const source = sources.find((item: SkillSourceRecord) => item.id === sourceId);
    if (!source) {
      throw new NotFoundException(`Skill source ${sourceId} not found`);
    }
    const snapshot = await ctx.runtimeStateRepository.load();
    const disabled = new Set(snapshot.governance?.disabledSkillSourceIds ?? []);
    if (enabled) {
      disabled.delete(sourceId);
    } else {
      disabled.add(sourceId);
    }
    snapshot.governance = {
      ...(snapshot.governance ?? {}),
      disabledSkillSourceIds: Array.from(disabled)
    };
    await ctx.runtimeStateRepository.save(snapshot);
    await appendGovernanceAudit(ctx.runtimeStateRepository, {
      actor: 'agent-admin-user',
      action: enabled ? 'skill-source.enabled' : 'skill-source.disabled',
      scope: 'skill-source',
      targetId: sourceId,
      outcome: 'success'
    });
    return (await listSkillSources(ctx.getSkillSourcesContext())).find(
      (item: SkillSourceRecord) => item.id === sourceId
    )!;
  }

  async setCompanyAgentEnabled(workerId: string, enabled: boolean) {
    const ctx = this.ctx();
    const worker = ctx.orchestrator
      .listWorkers()
      .find((item: CompanyWorkerRecord) => item.id === workerId && item.kind === 'company');
    if (!worker) {
      throw new NotFoundException(`Company worker ${workerId} not found`);
    }
    const snapshot = await ctx.runtimeStateRepository.load();
    const disabled = new Set(snapshot.governance?.disabledCompanyWorkerIds ?? []);
    if (enabled) {
      disabled.delete(workerId);
    } else {
      disabled.add(workerId);
    }
    snapshot.governance = {
      ...(snapshot.governance ?? {}),
      disabledCompanyWorkerIds: Array.from(disabled)
    };
    await ctx.runtimeStateRepository.save(snapshot);
    ctx.orchestrator.setWorkerEnabled(workerId, enabled);
    await appendGovernanceAudit(ctx.runtimeStateRepository, {
      actor: 'agent-admin-user',
      action: enabled ? 'company-worker.enabled' : 'company-worker.disabled',
      scope: 'company-worker',
      targetId: workerId,
      outcome: 'success'
    });
    return buildCompanyAgentsCenter({
      tasks: ctx.orchestrator.listTasks(),
      workers: ctx.orchestrator.listWorkers(),
      disabledWorkerIds: new Set(getDisabledCompanyWorkerIds(ctx.getConnectorRegistryContext()))
    }).find((item: { id: string }) => item.id === workerId)!;
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
