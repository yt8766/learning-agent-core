import { Module } from '@nestjs/common';

import { RuntimeController } from './runtime.controller';
import { RuntimeArchitectureService } from './architecture/runtime-architecture.service';
import { RuntimeHost } from './core/runtime.host';
import { RuntimeCentersService } from './centers/runtime-centers.service';
import {
  createRuntimeBootstrapService,
  createRuntimeCentersService,
  createRuntimeMessageGatewayFacadeService,
  createRuntimeKnowledgeService,
  createRuntimeScheduleService,
  createRuntimeSessionService,
  createRuntimeSkillCatalogService,
  createRuntimeTaskService,
  createRuntimeTechBriefingService,
  createRuntimeToolsService
} from './core/runtime-provider-factories';
import { RuntimeTechBriefingService } from './briefings/runtime-tech-briefing.service';
import { RuntimeBootstrapService } from './services/runtime-bootstrap.service';
import { RuntimeKnowledgeService } from './services/runtime-knowledge.service';
import { RuntimeMessageGatewayFacadeService } from './services/runtime-message-gateway-facade.service';
import { RuntimeOperationalStateService } from './services/runtime-operational-state.service';
import { RuntimeScheduleService } from './schedules/runtime-schedule.service';
import { RuntimeSessionService } from './services/runtime-session.service';
import { RuntimeSkillCatalogService } from './services/runtime-skill-catalog.service';
import { RuntimeTaskService } from './services/runtime-task.service';
import { RuntimeToolsService } from './services/runtime-tools.service';
import { RuntimeService } from './runtime.service';

@Module({
  controllers: [RuntimeController],
  providers: [
    RuntimeHost,
    RuntimeArchitectureService,
    RuntimeOperationalStateService,
    {
      provide: RuntimeTechBriefingService,
      useFactory: (runtimeHost: RuntimeHost) => createRuntimeTechBriefingService(runtimeHost),
      inject: [RuntimeHost]
    },
    {
      provide: RuntimeScheduleService,
      useFactory: (runtimeHost: RuntimeHost, techBriefingService: RuntimeTechBriefingService) =>
        createRuntimeScheduleService(runtimeHost, techBriefingService),
      inject: [RuntimeHost, RuntimeTechBriefingService]
    },
    {
      provide: RuntimeCentersService,
      useFactory: (
        runtimeHost: RuntimeHost,
        operationalState: RuntimeOperationalStateService,
        techBriefingService: RuntimeTechBriefingService
      ) => createRuntimeCentersService(runtimeHost, operationalState, techBriefingService),
      inject: [RuntimeHost, RuntimeOperationalStateService, RuntimeTechBriefingService]
    },
    {
      provide: RuntimeSessionService,
      useFactory: (runtimeHost: RuntimeHost) => createRuntimeSessionService(runtimeHost),
      inject: [RuntimeHost]
    },
    {
      provide: RuntimeKnowledgeService,
      useFactory: (runtimeHost: RuntimeHost) => createRuntimeKnowledgeService(runtimeHost),
      inject: [RuntimeHost]
    },
    {
      provide: RuntimeSkillCatalogService,
      useFactory: (runtimeHost: RuntimeHost) => createRuntimeSkillCatalogService(runtimeHost),
      inject: [RuntimeHost]
    },
    {
      provide: RuntimeTaskService,
      useFactory: (runtimeHost: RuntimeHost) => createRuntimeTaskService(runtimeHost),
      inject: [RuntimeHost]
    },
    {
      provide: RuntimeToolsService,
      useFactory: (runtimeHost: RuntimeHost) => createRuntimeToolsService(runtimeHost),
      inject: [RuntimeHost]
    },
    {
      provide: RuntimeMessageGatewayFacadeService,
      useFactory: (runtimeSessionService: RuntimeSessionService, runtimeTaskService: RuntimeTaskService) =>
        createRuntimeMessageGatewayFacadeService(runtimeSessionService, runtimeTaskService),
      inject: [RuntimeSessionService, RuntimeTaskService]
    },
    {
      provide: RuntimeBootstrapService,
      useFactory: (
        runtimeHost: RuntimeHost,
        operationalState: RuntimeOperationalStateService,
        techBriefingService: RuntimeTechBriefingService,
        runtimeScheduleService: RuntimeScheduleService
      ) => createRuntimeBootstrapService(runtimeHost, operationalState, techBriefingService, runtimeScheduleService),
      inject: [RuntimeHost, RuntimeOperationalStateService, RuntimeTechBriefingService, RuntimeScheduleService]
    },
    RuntimeService
  ],
  exports: [
    RuntimeHost,
    RuntimeCentersService,
    RuntimeSessionService,
    RuntimeKnowledgeService,
    RuntimeSkillCatalogService,
    RuntimeArchitectureService,
    RuntimeTaskService,
    RuntimeToolsService,
    RuntimeMessageGatewayFacadeService,
    RuntimeService
  ]
})
export class RuntimeModule {}
