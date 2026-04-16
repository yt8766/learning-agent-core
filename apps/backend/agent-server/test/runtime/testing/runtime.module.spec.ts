import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AppService } from '../../../src/app/app.service';
import { ChatCapabilityIntentsService } from '../../../src/chat/chat-capability-intents.service';
import { ChatService } from '../../../src/chat/chat.service';
import { MemoryService } from '../../../src/memory/memory.service';
import { SkillsService } from '../../../src/skills/skills.service';
import { TasksService } from '../../../src/modules/tasks/services/tasks.service';
import { RuntimeCentersService } from '../../../src/runtime/centers/runtime-centers.service';
import { RuntimeArchitectureService } from '../../../src/runtime/architecture/runtime-architecture.service';
import { RuntimeKnowledgeService } from '../../../src/runtime/services/runtime-knowledge.service';
import { RuntimeMessageGatewayFacadeService } from '../../../src/runtime/services/runtime-message-gateway-facade.service';
import { RuntimeModule } from '../../../src/runtime/runtime.module';
import { RuntimeService } from '../../../src/runtime/runtime.service';
import { RuntimeOperationalStateService } from '../../../src/runtime/services/runtime-operational-state.service';
import { RuntimeSessionService } from '../../../src/runtime/services/runtime-session.service';
import { RuntimeSkillCatalogService } from '../../../src/runtime/services/runtime-skill-catalog.service';
import { RuntimeTaskService } from '../../../src/runtime/services/runtime-task.service';

describe('RuntimeModule', () => {
  it('导出的 provider 能在 Nest 容器中解析，并支撑窄依赖服务注入', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RuntimeModule],
      providers: [AppService, ChatCapabilityIntentsService, ChatService, TasksService, MemoryService, SkillsService]
    }).compile();

    expect(moduleRef.get(RuntimeService)).toBeInstanceOf(RuntimeService);
    expect(moduleRef.get(RuntimeTaskService)).toBeInstanceOf(RuntimeTaskService);
    expect(moduleRef.get(RuntimeSessionService)).toBeInstanceOf(RuntimeSessionService);
    expect(moduleRef.get(RuntimeKnowledgeService)).toBeInstanceOf(RuntimeKnowledgeService);
    expect(moduleRef.get(RuntimeSkillCatalogService)).toBeInstanceOf(RuntimeSkillCatalogService);
    expect(moduleRef.get(RuntimeCentersService)).toBeInstanceOf(RuntimeCentersService);
    expect(moduleRef.get(RuntimeArchitectureService)).toBeInstanceOf(RuntimeArchitectureService);
    expect(moduleRef.get(RuntimeMessageGatewayFacadeService)).toBeInstanceOf(RuntimeMessageGatewayFacadeService);
    expect(moduleRef.get(RuntimeOperationalStateService)).toBeInstanceOf(RuntimeOperationalStateService);

    expect(moduleRef.get(AppService)).toBeInstanceOf(AppService);
    expect(moduleRef.get(ChatCapabilityIntentsService)).toBeInstanceOf(ChatCapabilityIntentsService);
    expect(moduleRef.get(ChatService)).toBeInstanceOf(ChatService);
    expect(moduleRef.get(TasksService)).toBeInstanceOf(TasksService);
    expect(moduleRef.get(MemoryService)).toBeInstanceOf(MemoryService);
    expect(moduleRef.get(SkillsService)).toBeInstanceOf(SkillsService);
  });
});
