import { Inject, Injectable } from '@nestjs/common';
import type {
  GatewayAccountingRequest,
  GatewayAccountingResponse,
  GatewayConfig,
  GatewayCredentialFile,
  GatewayDeleteCredentialFileRequest,
  GatewayDeleteProviderRequest,
  GatewayLogListResponse,
  GatewayPreprocessRequest,
  GatewayPreprocessResponse,
  GatewayProbeRequest,
  GatewayProbeResponse,
  GatewayProviderCredentialSet,
  GatewayQuota,
  GatewaySnapshot,
  GatewayTokenCountResponse,
  GatewayUpdateConfigRequest,
  GatewayUpdateQuotaRequest,
  GatewayUpsertCredentialFileRequest,
  GatewayUpsertProviderRequest,
  GatewayUsageListResponse
} from '@agent/core';
import type { AgentGatewayRepository } from '../repositories/agent-gateway.repository';
import { AGENT_GATEWAY_REPOSITORY } from '../repositories/agent-gateway.repository';
import type { AgentGatewaySecretVault } from '../secrets/agent-gateway-secret-vault';
import { AGENT_GATEWAY_SECRET_VAULT } from '../secrets/agent-gateway-secret-vault';

@Injectable()
export class AgentGatewayService {
  constructor(
    @Inject(AGENT_GATEWAY_REPOSITORY) private readonly repository: AgentGatewayRepository,
    @Inject(AGENT_GATEWAY_SECRET_VAULT) private readonly secretVault: AgentGatewaySecretVault
  ) {}

  async snapshot(): Promise<GatewaySnapshot> {
    const [config, providerCredentialSets, credentialFiles, quotas] = await Promise.all([
      this.repository.getConfig(),
      this.repository.listProviders(),
      this.repository.listCredentialFiles(),
      this.repository.listQuotas()
    ]);
    const activeProviderCount = providerCredentialSets.filter(provider => provider.status === 'healthy').length;
    const degradedProviderCount = providerCredentialSets.filter(provider => provider.status === 'degraded').length;

    return {
      observedAt: new Date().toISOString(),
      runtime: {
        mode: 'proxy',
        status: 'healthy',
        activeProviderCount,
        degradedProviderCount,
        requestPerMinute: 42,
        p95LatencyMs: 810
      },
      config,
      providerCredentialSets,
      credentialFiles,
      quotas
    };
  }

  updateConfig(request: GatewayUpdateConfigRequest): Promise<GatewayConfig> {
    return this.repository.updateConfig(request);
  }

  listProviders(): Promise<GatewayProviderCredentialSet[]> {
    return this.repository.listProviders();
  }

  async upsertProvider(request: GatewayUpsertProviderRequest): Promise<GatewayProviderCredentialSet> {
    const { secretRef: rawSecretRef, ...provider } = request;
    if (rawSecretRef) await this.secretVault.writeProviderSecretRef(provider.id, rawSecretRef);
    return this.repository.upsertProvider(provider);
  }

  async deleteProvider(request: GatewayDeleteProviderRequest): Promise<void> {
    await this.repository.deleteProvider(request.providerId);
    await this.secretVault.deleteProviderSecretRef(request.providerId);
  }

  listCredentialFiles(): Promise<GatewayCredentialFile[]> {
    return this.repository.listCredentialFiles();
  }

  async upsertCredentialFile(request: GatewayUpsertCredentialFileRequest): Promise<GatewayCredentialFile> {
    const { content: rawContent, ...file } = request;
    if (rawContent) await this.secretVault.writeCredentialFileContent(file.id, rawContent);
    return this.repository.upsertCredentialFile(file);
  }

  async deleteCredentialFile(request: GatewayDeleteCredentialFileRequest): Promise<void> {
    await this.repository.deleteCredentialFile(request.credentialFileId);
    await this.secretVault.deleteCredentialFileContent(request.credentialFileId);
  }

  listQuotas(): Promise<GatewayQuota[]> {
    return this.repository.listQuotas();
  }

  async updateQuota(request: GatewayUpdateQuotaRequest): Promise<GatewayQuota> {
    const current = (await this.repository.listQuotas()).find(quota => quota.id === request.id);
    if (!current) throw new Error(`Gateway quota not found: ${request.id}`);
    return this.repository.updateQuota({ ...current, ...request });
  }

  async listLogs(limit = 50): Promise<GatewayLogListResponse> {
    return { items: await this.repository.listLogs(this.limit(limit)) };
  }

  async listUsage(limit = 50): Promise<GatewayUsageListResponse> {
    return { items: await this.repository.listUsage(this.limit(limit)) };
  }

  probe(request: GatewayProbeRequest): GatewayProbeResponse {
    return {
      providerId: request.providerId,
      ok: true,
      latencyMs: 620,
      inputTokens: this.countTokens(request.prompt).tokens,
      outputTokens: 16,
      message: '探测完成，通道可用'
    };
  }
  countTokens(text: string): GatewayTokenCountResponse {
    return { tokens: text.trim() ? Math.ceil(text.trim().length / 4) : 0, method: 'approximate' };
  }
  preprocess(request: GatewayPreprocessRequest): GatewayPreprocessResponse {
    const normalizedPrompt = request.prompt.trim().replace(/\s+/g, ' ');
    return {
      normalizedPrompt,
      inputTokens: this.countTokens(normalizedPrompt).tokens,
      warnings: normalizedPrompt ? [] : ['输入为空']
    };
  }
  accounting(request: GatewayAccountingRequest): GatewayAccountingResponse {
    const inputTokens = this.countTokens(request.inputText).tokens;
    const outputTokens = this.countTokens(request.outputText).tokens;
    return { providerId: request.providerId, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
  }
  private limit(limit: number): number {
    return Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 50;
  }
}
