import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { MessageGatewayController } from './message-gateway.controller';
import { MessageGatewayDeliveryQueueService } from './message-gateway-delivery-queue.service';
import { MessageGatewayService } from './message-gateway.service';

@Module({
  imports: [RuntimeModule],
  controllers: [MessageGatewayController],
  providers: [MessageGatewayDeliveryQueueService, MessageGatewayService]
})
export class MessageGatewayModule {}
