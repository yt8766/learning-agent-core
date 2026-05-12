import { Inject, Injectable, Optional } from '@nestjs/common';
import { z } from 'zod';
import {
  GatewayMigrationApplyResponseSchema,
  GatewayMigrationPreviewSchema,
  GatewayQuotaDetailSchema,
  type GatewayApiKey,
  type GatewayAuthFile,
  type GatewayMigrationApplyItem,
  type GatewayMigrationApplyResponse,
  type GatewayMigrationConflict,
  type GatewayMigrationPreview,
  type GatewayMigrationResourceKind,
  type GatewayMigrationResourcePreview,
  type GatewayProviderSpecificConfigRecord,
  type GatewayQuotaDetail,
  type GatewayRequestLogEntry
} from '@agent/core';
import {
  AGENT_GATEWAY_CLIENT_REPOSITORY,
  type AgentGatewayClientRepository
} from '../clients/agent-gateway-client.repository';
import type { AgentGatewayManagementClient } from '../management/agent-gateway-management-client';
import { CliProxyManagementClient } from '../management/cli-proxy-management-client';
import { AGENT_GATEWAY_REPOSITORY, type AgentGatewayRepository } from '../repositories/agent-gateway.repository';
import {
  mapApiKeyToImportedClientApiKey,
  mapAuthFileToCredentialFile,
  mapProviderConfigToLocalProvider,
  mapQuotaDetailToLocalQuota,
  mapRequestLogToLocalLog,
  parseRawConfigPatch
} from './cli-proxy-import.mapper';
import {
  conflictResource,
  errorMessage,
  hashImportedApiKey,
  normalizeApiKeyForImport,
  normalizeAuthFileForImport,
  normalizeProviderConfigForImport,
  normalizeRequestLogForImport
} from './cli-proxy-import.normalizers';

export const AGENT_GATEWAY_MIGRATION_SOURCE_FACTORY = Symbol('AGENT_GATEWAY_MIGRATION_SOURCE_FACTORY');

const GatewayMigrationBaseRequestSchema = z
  .object({
    apiBase: z.string().min(1),
    managementKey: z.string().min(1),
    timeoutMs: z.number().int().positive().max(120000).optional()
  })
  .strict();

export const GatewayMigrationPreviewRequestSchema = GatewayMigrationBaseRequestSchema;

export const GatewayMigrationApplyRequestSchema = GatewayMigrationBaseRequestSchema.extend({
  selectedSourceIds: z.array(z.string().min(1)).optional(),
  confirmUnsafeConflicts: z.boolean().default(false)
}).strict();

export type GatewayMigrationPreviewRequest = z.infer<typeof GatewayMigrationPreviewRequestSchema>;
export type GatewayMigrationApplyRequest = z.infer<typeof GatewayMigrationApplyRequestSchema>;
export type GatewayMigrationSourceFactory = (request: GatewayMigrationPreviewRequest) => AgentGatewayManagementClient;

interface DiscoveredMigrationResources {
  apiKeys: GatewayApiKey[];
  authFiles: GatewayAuthFile[];
  configPatchSourceId: string | null;
  logs: GatewayRequestLogEntry[];
  providerConfigs: GatewayProviderSpecificConfigRecord[];
  quotas: GatewayQuotaDetail[];
  source: GatewayMigrationPreview['source'];
}

@Injectable()
export class CliProxyImportService {
  constructor(
    @Inject(AGENT_GATEWAY_REPOSITORY) private readonly repository: AgentGatewayRepository,
    @Inject(AGENT_GATEWAY_CLIENT_REPOSITORY) private readonly clientRepository: AgentGatewayClientRepository,
    @Optional()
    @Inject(AGENT_GATEWAY_MIGRATION_SOURCE_FACTORY)
    private readonly sourceFactory: GatewayMigrationSourceFactory = request =>
      new CliProxyManagementClient({
        apiBase: request.apiBase,
        managementKey: request.managementKey,
        timeoutMs: request.timeoutMs
      })
  ) {}

  async preview(request: GatewayMigrationPreviewRequest): Promise<GatewayMigrationPreview> {
    const discovered = await this.discover(request);
    const existing = await this.readExistingIds();
    const resources: GatewayMigrationResourcePreview[] = [];
    const conflicts: GatewayMigrationConflict[] = [];

    if (discovered.configPatchSourceId) {
      resources.push({
        kind: 'config',
        sourceId: discovered.configPatchSourceId,
        targetId: 'gateway-config',
        action: 'update',
        safe: true,
        summary: 'Import compatible config fields'
      });
    }

    for (const provider of discovered.providerConfigs) {
      const action = existing.providers.has(provider.id) ? 'update' : 'create';
      resources.push({
        kind: 'providerConfig',
        sourceId: provider.id,
        targetId: provider.id,
        action,
        safe: true,
        summary: provider.displayName
      });
    }

    for (const authFile of discovered.authFiles) {
      if (existing.credentialFiles.has(authFile.id)) {
        resources.push(conflictResource('authFile', authFile.id, authFile.id, authFile.fileName));
        conflicts.push({
          kind: 'authFile',
          sourceId: authFile.id,
          targetId: authFile.id,
          reason: 'Local auth file metadata already exists',
          resolution: 'skip'
        });
      } else {
        resources.push({
          kind: 'authFile',
          sourceId: authFile.id,
          targetId: authFile.id,
          action: 'create',
          safe: true,
          summary: authFile.fileName
        });
      }
    }

    for (const quota of discovered.quotas) {
      resources.push({
        kind: 'quota',
        sourceId: quota.id,
        targetId: quota.id,
        action: existing.quotas.has(quota.id) ? 'update' : 'create',
        safe: true,
        summary: `${quota.providerId} ${quota.used}/${quota.limit}`
      });
    }

    for (const log of discovered.logs) {
      resources.push({
        kind: 'requestLog',
        sourceId: log.id,
        targetId: log.id,
        action: existing.logs.has(log.id) ? 'skip' : 'create',
        safe: true,
        summary: `${log.method} ${log.path}`
      });
    }

    for (const apiKey of discovered.apiKeys) {
      resources.push(conflictResource('apiKey', apiKey.id, 'cli-proxy-import', apiKey.name));
      conflicts.push({
        kind: 'apiKey',
        sourceId: apiKey.id,
        targetId: 'cli-proxy-import',
        reason: 'Only masked API key metadata is available; importing requires explicit confirmation',
        resolution: 'manual'
      });
    }

    const preview = {
      source: discovered.source,
      resources,
      conflicts,
      totals: {
        create: resources.filter(resource => resource.action === 'create').length,
        update: resources.filter(resource => resource.action === 'update').length,
        skip: resources.filter(resource => resource.action === 'skip').length,
        conflict: resources.filter(resource => resource.action === 'conflict').length
      }
    };
    return GatewayMigrationPreviewSchema.parse(preview);
  }

  async apply(request: GatewayMigrationApplyRequest): Promise<GatewayMigrationApplyResponse> {
    const discovered = await this.discover(request);
    const preview = await this.preview(request);
    const selected = new Set(request.selectedSourceIds ?? preview.resources.map(resource => resource.sourceId));
    const resourceBySourceId = new Map(preview.resources.map(resource => [resource.sourceId, resource]));
    const imported: GatewayMigrationApplyItem[] = [];
    const skipped: GatewayMigrationApplyItem[] = [];
    const failed: GatewayMigrationApplyResponse['failed'] = [];
    const warnings: string[] = [];
    const appliedAt = new Date().toISOString();

    const shouldApply = (sourceId: string): boolean => selected.has(sourceId);
    const isUnsafe = (sourceId: string): boolean => resourceBySourceId.get(sourceId)?.safe === false;
    const skipUnsafe = (kind: GatewayMigrationResourceKind, sourceId: string, targetId: string): boolean => {
      if (!isUnsafe(sourceId) || request.confirmUnsafeConflicts) return false;
      skipped.push({ kind, sourceId, targetId, reason: 'unsafe conflict requires confirmation' });
      warnings.push(`${kind}:${sourceId} skipped because unsafe conflict requires confirmation`);
      return true;
    };

    if (discovered.configPatchSourceId && shouldApply(discovered.configPatchSourceId)) {
      try {
        const source = this.sourceFactory(request);
        const patch = parseRawConfigPatch(await source.readRawConfig());
        if (patch) {
          await this.repository.updateConfig(patch);
          imported.push({ kind: 'config', sourceId: discovered.configPatchSourceId, targetId: 'gateway-config' });
        } else {
          skipped.push({ kind: 'config', sourceId: discovered.configPatchSourceId, targetId: 'gateway-config' });
        }
      } catch (error) {
        failed.push({ kind: 'config', sourceId: discovered.configPatchSourceId, reason: errorMessage(error) });
      }
    }

    for (const provider of discovered.providerConfigs.filter(provider => shouldApply(provider.id))) {
      try {
        await this.repository.upsertProvider(mapProviderConfigToLocalProvider(provider));
        imported.push({ kind: 'providerConfig', sourceId: provider.id, targetId: provider.id });
      } catch (error) {
        failed.push({ kind: 'providerConfig', sourceId: provider.id, reason: errorMessage(error) });
      }
    }

    for (const authFile of discovered.authFiles.filter(file => shouldApply(file.id))) {
      try {
        if (skipUnsafe('authFile', authFile.id, authFile.id)) continue;
        await this.repository.upsertCredentialFile(mapAuthFileToCredentialFile(authFile));
        imported.push({ kind: 'authFile', sourceId: authFile.id, targetId: authFile.id });
      } catch (error) {
        failed.push({ kind: 'authFile', sourceId: authFile.id, reason: errorMessage(error) });
      }
    }

    for (const quota of discovered.quotas.filter(quota => shouldApply(quota.id))) {
      try {
        await this.repository.updateQuota(mapQuotaDetailToLocalQuota(quota));
        imported.push({ kind: 'quota', sourceId: quota.id, targetId: quota.id });
      } catch (error) {
        failed.push({ kind: 'quota', sourceId: quota.id, reason: errorMessage(error) });
      }
    }

    for (const log of discovered.logs.filter(log => shouldApply(log.id))) {
      try {
        await this.repository.appendLog(mapRequestLogToLocalLog(log));
        imported.push({ kind: 'requestLog', sourceId: log.id, targetId: log.id });
      } catch (error) {
        failed.push({ kind: 'requestLog', sourceId: log.id, reason: errorMessage(error) });
      }
    }

    for (const apiKey of discovered.apiKeys.filter(apiKey => shouldApply(apiKey.id))) {
      try {
        if (skipUnsafe('apiKey', apiKey.id, 'cli-proxy-import')) continue;
        await this.ensureImportedClient(appliedAt);
        if (await this.clientRepository.findApiKey('cli-proxy-import', apiKey.id)) {
          skipped.push({ kind: 'apiKey', sourceId: apiKey.id, targetId: apiKey.id, reason: 'already imported' });
          continue;
        }
        await this.clientRepository.createApiKey({
          ...mapApiKeyToImportedClientApiKey(apiKey, appliedAt),
          secretHash: hashImportedApiKey(apiKey)
        });
        imported.push({ kind: 'apiKey', sourceId: apiKey.id, targetId: apiKey.id });
      } catch (error) {
        failed.push({ kind: 'apiKey', sourceId: apiKey.id, reason: errorMessage(error) });
      }
    }

    return GatewayMigrationApplyResponseSchema.parse({
      migrationId: `cli-proxy-${Date.now()}`,
      appliedAt,
      imported,
      skipped,
      failed,
      warnings
    });
  }

  private async discover(request: GatewayMigrationPreviewRequest): Promise<DiscoveredMigrationResources> {
    const source = this.sourceFactory(request);
    const [connection, rawConfig, providerConfigs, authFiles, apiKeys, quotas, logs] = await Promise.all([
      source.checkConnection(),
      source.readRawConfig(),
      source.listProviderConfigs(),
      source.listAuthFiles({ limit: 500 }),
      source.listApiKeys(),
      source.listQuotaDetails(),
      source.searchLogs({ limit: 100, hideManagementTraffic: true })
    ]);
    return {
      source: {
        apiBase: request.apiBase,
        serverVersion: connection.serverVersion,
        checkedAt: connection.checkedAt
      },
      configPatchSourceId: parseRawConfigPatch(rawConfig) ? 'config.yaml' : null,
      providerConfigs: providerConfigs.items.map(item => normalizeProviderConfigForImport(item)),
      authFiles: authFiles.items.map(item => normalizeAuthFileForImport(item)),
      apiKeys: apiKeys.items.map((item, index) => normalizeApiKeyForImport(item, index)),
      quotas: quotas.items.map(item => GatewayQuotaDetailSchema.parse(item)),
      logs: logs.items.map(item => normalizeRequestLogForImport(item))
    };
  }

  private async readExistingIds(): Promise<{
    credentialFiles: Set<string>;
    logs: Set<string>;
    providers: Set<string>;
    quotas: Set<string>;
  }> {
    const [providers, credentialFiles, quotas, logs] = await Promise.all([
      this.repository.listProviders(),
      this.repository.listCredentialFiles(),
      this.repository.listQuotas(),
      this.repository.listLogs(100)
    ]);
    return {
      providers: new Set(providers.map(provider => provider.id)),
      credentialFiles: new Set(credentialFiles.map(file => file.id)),
      quotas: new Set(quotas.map(quota => quota.id)),
      logs: new Set(logs.map(log => log.id))
    };
  }

  private async ensureImportedClient(now: string): Promise<void> {
    const existing = await this.clientRepository.findClient('cli-proxy-import');
    if (existing) return;
    await this.clientRepository.createClient({
      id: 'cli-proxy-import',
      name: 'Imported CLIProxyAPI clients',
      status: 'active',
      tags: ['migration', 'cli-proxy'],
      createdAt: now,
      updatedAt: now
    });
  }
}
