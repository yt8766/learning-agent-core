import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [RuntimeModule],
  controllers: [ChatController],
  providers: [ChatService]
})
export class ChatModule {}
