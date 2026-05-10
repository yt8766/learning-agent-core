import { Module } from '@nestjs/common';
import { AgentGatewayAuthController } from '../../api/agent-gateway/agent-gateway-auth.controller';
import { AgentGatewayController } from '../../api/agent-gateway/agent-gateway.controller';
import { AgentGatewayManagementController } from '../../api/agent-gateway/agent-gateway-management.controller';
import { IdentityModule } from '../identity/identity.module';
import { AgentGatewayApiKeyService } from './api-keys/agent-gateway-api-key.service';
import { AgentGatewayAuthFileManagementService } from './auth-files/agent-gateway-auth-file-management.service';
import { AgentGatewayAuthGuard } from './auth/agent-gateway-auth.guard';
import { AgentGatewayAuthService } from './auth/agent-gateway-auth.service';
import { AgentGatewayConfigFileService } from './config/agent-gateway-config-file.service';
import { AgentGatewayDashboardService } from './dashboard/agent-gateway-dashboard.service';
import { AgentGatewayConnectionService } from './management/agent-gateway-connection.service';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from './management/agent-gateway-management-client';
import { CliProxyManagementClient } from './management/cli-proxy-management-client';
import { MemoryAgentGatewayManagementClient } from './management/memory-agent-gateway-management-client';
import { AgentGatewayOAuthService } from './oauth/agent-gateway-oauth.service';
import { AgentGatewayOAuthPolicyService } from './oauth/agent-gateway-oauth-policy.service';
import { AGENT_GATEWAY_PROVIDERS } from './providers/agent-gateway-provider';
import { MockAgentGatewayProvider } from './providers/mock-agent-gateway-provider';
import { AgentGatewayProviderConfigService } from './providers/agent-gateway-provider-config.service';
import { AgentGatewayApiCallService } from './quotas/agent-gateway-api-call.service';
import { AgentGatewayQuotaDetailService } from './quotas/agent-gateway-quota-detail.service';
import { AGENT_GATEWAY_REPOSITORY } from './repositories/agent-gateway.repository';
import { MemoryAgentGatewayRepository } from './repositories/memory-agent-gateway.repository';
import { AgentGatewayRelayService } from './runtime/agent-gateway-relay.service';
import { AGENT_GATEWAY_SECRET_VAULT, MemoryAgentGatewaySecretVault } from './secrets/agent-gateway-secret-vault';
import { AgentGatewayService } from './services/agent-gateway.service';
import { AgentGatewayLogService } from './logs/agent-gateway-log.service';
import { AgentGatewaySystemService } from './system/agent-gateway-system.service';
@Module({
  imports: [IdentityModule],
  controllers: [AgentGatewayAuthController, AgentGatewayController, AgentGatewayManagementController],
  providers: [
    AgentGatewayAuthGuard,
    AgentGatewayAuthService,
    AgentGatewayService,
    AgentGatewayOAuthService,
    AgentGatewayRelayService,
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
      provide: AGENT_GATEWAY_REPOSITORY,
      useClass: MemoryAgentGatewayRepository
    },
    {
      provide: AGENT_GATEWAY_SECRET_VAULT,
      useClass: MemoryAgentGatewaySecretVault
    },
    {
      provide: AGENT_GATEWAY_PROVIDERS,
      useFactory: (mockProvider: MockAgentGatewayProvider) => [mockProvider],
      inject: [MockAgentGatewayProvider]
    }
  ],
  exports: [
    AgentGatewayAuthService,
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
    AgentGatewaySystemService
  ]
})
export class AgentGatewayModule {}
