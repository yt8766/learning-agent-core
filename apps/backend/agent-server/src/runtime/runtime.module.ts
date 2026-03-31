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
  createRuntimeSessionService,
  createRuntimeSkillCatalogService,
  createRuntimeTaskService,
  createRuntimeToolsService
} from './core/runtime-provider-factories';
import { RuntimeBootstrapService } from './services/runtime-bootstrap.service';
import { RuntimeKnowledgeService } from './services/runtime-knowledge.service';
import { RuntimeMessageGatewayFacadeService } from './services/runtime-message-gateway-facade.service';
import { RuntimeOperationalStateService } from './services/runtime-operational-state.service';
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
      provide: RuntimeCentersService,
      useFactory: (runtimeHost: RuntimeHost, operationalState: RuntimeOperationalStateService) =>
        createRuntimeCentersService(runtimeHost, operationalState),
      inject: [RuntimeHost, RuntimeOperationalStateService]
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
      useFactory: (runtimeHost: RuntimeHost, operationalState: RuntimeOperationalStateService) =>
        createRuntimeBootstrapService(runtimeHost, operationalState),
      inject: [RuntimeHost, RuntimeOperationalStateService]
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
