import { Module } from '@nestjs/common';
import { AgentGatewayAuthController } from '../../api/agent-gateway/agent-gateway-auth.controller';
import { AgentGatewayClientsController } from '../../api/agent-gateway/agent-gateway-clients.controller';
import { AgentGatewayController } from '../../api/agent-gateway/agent-gateway.controller';
import { AgentGatewayManagementController } from '../../api/agent-gateway/agent-gateway-management.controller';
import { AgentGatewayMigrationController } from '../../api/agent-gateway/agent-gateway-migration.controller';
import { AgentGatewayOAuthCallbackController } from '../../api/agent-gateway/agent-gateway-oauth-callback.controller';
import { AgentGatewayOpenAICompatibleController } from '../../api/agent-gateway/agent-gateway-openai-compatible.controller';
import { AgentGatewayProviderRuntimeController } from '../../api/agent-gateway/agent-gateway-provider-runtime.controller';
import { IdentityModule } from '../identity/identity.module';
import { AgentGatewayApiKeyService } from './api-keys/agent-gateway-api-key.service';
import { AgentGatewayAuthFileManagementService } from './auth-files/agent-gateway-auth-file-management.service';
import { AgentGatewayAuthGuard } from './auth/agent-gateway-auth.guard';
import { AgentGatewayAuthService } from './auth/agent-gateway-auth.service';
import { AgentGatewayClientApiKeyService } from './clients/agent-gateway-client-api-key.service';
import { AgentGatewayClientQuotaService } from './clients/agent-gateway-client-quota.service';
import { AgentGatewayClientService } from './clients/agent-gateway-client.service';
import { AgentGatewayConfigFileService } from './config/agent-gateway-config-file.service';
import { AgentGatewayDashboardService } from './dashboard/agent-gateway-dashboard.service';
import { AgentGatewayConnectionService } from './management/agent-gateway-connection.service';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from './management/agent-gateway-management-client';
import { CliProxyManagementClient } from './management/cli-proxy-management-client';
import { MemoryAgentGatewayManagementClient } from './management/memory-agent-gateway-management-client';
import { AGENT_GATEWAY_MIGRATION_SOURCE_FACTORY, CliProxyImportService } from './migration/cli-proxy-import.service';
import { AgentGatewayOAuthService } from './oauth/agent-gateway-oauth.service';
import { AgentGatewayOAuthPolicyService } from './oauth/agent-gateway-oauth-policy.service';
import { createAgentGatewayPersistenceProviders } from './persistence/postgres-agent-gateway.repository';
import { AGENT_GATEWAY_PROVIDERS } from './providers/agent-gateway-provider';
import { MockAgentGatewayProvider } from './providers/mock-agent-gateway-provider';
import { AgentGatewayProviderConfigService } from './providers/agent-gateway-provider-config.service';
import { AgentGatewayApiCallService } from './quotas/agent-gateway-api-call.service';
import { AgentGatewayQuotaDetailService } from './quotas/agent-gateway-quota-detail.service';
import { AgentGatewayRelayService } from './runtime/agent-gateway-relay.service';
import { AgentGatewayRuntimeAccountingService } from './runtime/agent-gateway-runtime-accounting.service';
import { AgentGatewayRuntimeAuthService } from './runtime/agent-gateway-runtime-auth.service';
import { RuntimeEngineModule } from './runtime-engine/runtime-engine.module';
import { RuntimeStreamingService } from './runtime-engine/streaming/runtime-streaming.service';
import { AgentGatewayService } from './services/agent-gateway.service';
import { AgentGatewayLogService } from './logs/agent-gateway-log.service';
import { AgentGatewaySystemService } from './system/agent-gateway-system.service';
import { AgentGatewayUsageAnalyticsService } from './usage/agent-gateway-usage-analytics.service';
@Module({
  imports: [IdentityModule, RuntimeEngineModule],
  controllers: [
    AgentGatewayAuthController,
    AgentGatewayClientsController,
    AgentGatewayController,
    AgentGatewayManagementController,
    AgentGatewayMigrationController,
    AgentGatewayOAuthCallbackController,
    AgentGatewayOpenAICompatibleController,
    AgentGatewayProviderRuntimeController
  ],
  providers: [
    AgentGatewayAuthGuard,
    AgentGatewayAuthService,
    AgentGatewayClientService,
    AgentGatewayClientApiKeyService,
    AgentGatewayClientQuotaService,
    AgentGatewayService,
    AgentGatewayOAuthService,
    AgentGatewayRelayService,
    AgentGatewayRuntimeAccountingService,
    AgentGatewayRuntimeAuthService,
    RuntimeStreamingService,
    AgentGatewayConnectionService,
    AgentGatewayConfigFileService,
    AgentGatewayApiKeyService,
    AgentGatewayDashboardService,
    AgentGatewayProviderConfigService,
    AgentGatewayAuthFileManagementService,
    AgentGatewayOAuthPolicyService,
    AgentGatewayApiCallService,
    AgentGatewayLogService,
    AgentGatewayQuotaDetailService,
    AgentGatewaySystemService,
    AgentGatewayUsageAnalyticsService,
    CliProxyImportService,
    MockAgentGatewayProvider,
    {
      provide: AGENT_GATEWAY_MANAGEMENT_CLIENT,
      useFactory: () => {
        if (process.env.AGENT_GATEWAY_MANAGEMENT_MODE === 'cli-proxy') {
          return new CliProxyManagementClient({
            apiBase: process.env.AGENT_GATEWAY_MANAGEMENT_API_BASE ?? '',
            managementKey: process.env.AGENT_GATEWAY_MANAGEMENT_KEY ?? ''
          });
        }
        return new MemoryAgentGatewayManagementClient();
      }
    },
    {
      provide: AGENT_GATEWAY_MIGRATION_SOURCE_FACTORY,
      useValue: (request: { apiBase: string; managementKey: string; timeoutMs?: number }) =>
        new CliProxyManagementClient({
          apiBase: request.apiBase,
          managementKey: request.managementKey,
          timeoutMs: request.timeoutMs
        })
    },
    ...createAgentGatewayPersistenceProviders(),
    {
      provide: AGENT_GATEWAY_PROVIDERS,
      useFactory: (mockProvider: MockAgentGatewayProvider) => [mockProvider],
      inject: [MockAgentGatewayProvider]
    }
  ],
  exports: [
    AgentGatewayAuthService,
    AgentGatewayClientService,
    AgentGatewayClientApiKeyService,
    AgentGatewayClientQuotaService,
    AgentGatewayService,
    AgentGatewayOAuthService,
    AgentGatewayConnectionService,
    AgentGatewayConfigFileService,
    AgentGatewayApiKeyService,
    AgentGatewayDashboardService,
    AgentGatewayProviderConfigService,
    AgentGatewayAuthFileManagementService,
    AgentGatewayOAuthPolicyService,
    AgentGatewayApiCallService,
    AgentGatewayLogService,
    AgentGatewayQuotaDetailService,
    AgentGatewaySystemService,
    AgentGatewayUsageAnalyticsService,
    CliProxyImportService,
    AgentGatewayRuntimeAccountingService,
    AgentGatewayRuntimeAuthService,
    RuntimeStreamingService
  ]
})
export class AgentGatewayModule {}
