import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { ChatCapabilityIntentsService } from './chat-capability-intents.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [RuntimeModule],
  controllers: [ChatController],
  providers: [ChatCapabilityIntentsService, ChatService]
})
export class ChatModule {}
