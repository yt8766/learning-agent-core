import { Body, Controller, Get, Headers, Post } from '@nestjs/common';

import { FeishuWebhookDto } from './dto/feishu-webhook.dto';
import { TelegramWebhookDto } from './dto/telegram-webhook.dto';
import { MessageGatewayService } from './message-gateway.service';

@Controller('gateway')
export class MessageGatewayController {
  constructor(private readonly messageGatewayService: MessageGatewayService) {}

  @Get('deliveries')
  listDeliveries() {
    return this.messageGatewayService.listOutboundQueue();
  }

  @Post('telegram/webhook')
  handleTelegramWebhook(
    @Body() payload: TelegramWebhookDto,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    return this.messageGatewayService.handleTelegramWebhook(payload, headers);
  }

  @Post('feishu/webhook')
  handleFeishuWebhook(
    @Body() payload: FeishuWebhookDto,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    return this.messageGatewayService.handleFeishuWebhook(payload, headers);
  }
}
