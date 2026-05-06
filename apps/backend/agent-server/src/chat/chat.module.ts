import { Module } from '@nestjs/common';

import { AgentToolsModule } from '../agent-tools/agent-tools.module';
import { RuntimeModule } from '../runtime/runtime.module';
import { ChatCapabilityIntentsService } from './chat-capability-intents.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PendingInteractionService } from './pending-interaction.service';
import { ChatRunRepository } from './chat-run.repository';
import { ChatRunService } from './chat-run.service';
import { ChatViewStreamController } from './chat-view-stream.controller';
import { ChatViewStreamService } from './chat-view-stream.service';

@Module({
  imports: [RuntimeModule, AgentToolsModule],
  controllers: [ChatController, ChatViewStreamController],
  providers: [
    ChatCapabilityIntentsService,
    PendingInteractionService,
    ChatRunRepository,
    ChatRunService,
    ChatViewStreamService,
    ChatService
  ]
})
export class ChatModule {}
