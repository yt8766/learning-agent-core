import { Module } from '@nestjs/common';
import { AgentGatewayAuthController } from '../../api/agent-gateway/agent-gateway-auth.controller';
import { AgentGatewayController } from '../../api/agent-gateway/agent-gateway.controller';
import { AgentGatewayAuthGuard } from './auth/agent-gateway-auth.guard';
import { AgentGatewayAuthService } from './auth/agent-gateway-auth.service';
import { AgentGatewayService } from './services/agent-gateway.service';
@Module({
  controllers: [AgentGatewayAuthController, AgentGatewayController],
  providers: [AgentGatewayAuthGuard, AgentGatewayAuthService, AgentGatewayService],
  exports: [AgentGatewayAuthService, AgentGatewayService]
})
export class AgentGatewayModule {}
