import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { AgentToolsService } from './agent-tools.service';
import type {
  AgentToolApprovalRequest,
  AgentToolCancelRequest,
  AgentToolNodeHealthCheckRequest
} from './agent-tools.schemas';
import type {
  AgentToolCapabilityQuery,
  AgentToolEventsQuery,
  AgentToolNodeQuery,
  AgentToolProjectionQuery
} from './agent-tools.types';

@Controller('agent-tools')
export class AgentToolsController {
  constructor(private readonly agentToolsService: AgentToolsService) {}

  @Get('capabilities')
  listCapabilities(@Query() query: AgentToolCapabilityQuery) {
    return this.agentToolsService.listCapabilities(query);
  }

  @Get('nodes')
  listNodes(@Query() query: AgentToolNodeQuery) {
    return this.agentToolsService.listNodes(query);
  }

  @Get('nodes/:nodeId')
  getNode(@Param('nodeId') nodeId: string) {
    return this.agentToolsService.getNode(nodeId);
  }

  @Get('requests/:requestId')
  getRequest(@Param('requestId') requestId: string) {
    return this.agentToolsService.getRequest(requestId);
  }

  @Get('requests/:requestId/result')
  getResult(@Param('requestId') requestId: string) {
    return this.agentToolsService.getResult(requestId);
  }

  @Get('events')
  listEvents(@Query() query: AgentToolEventsQuery) {
    return this.agentToolsService.listEvents(query);
  }

  @Get('projection')
  getProjection(@Query() query: AgentToolProjectionQuery) {
    return this.agentToolsService.getProjection(query);
  }

  @Post('requests')
  createRequest(@Body() body: unknown) {
    return this.agentToolsService.createRequest(body);
  }

  @Post('requests/:requestId/cancel')
  cancelRequest(@Param('requestId') requestId: string, @Body() body: AgentToolCancelRequest) {
    return this.agentToolsService.cancelRequest(requestId, body);
  }

  @Post('requests/:requestId/approval')
  resumeApproval(@Param('requestId') requestId: string, @Body() body: AgentToolApprovalRequest) {
    return this.agentToolsService.resumeApproval(requestId, body);
  }

  @Post('nodes/:nodeId/health-check')
  healthCheckNode(@Param('nodeId') nodeId: string, @Body() body: AgentToolNodeHealthCheckRequest) {
    return this.agentToolsService.healthCheckNode(nodeId, body);
  }
}
