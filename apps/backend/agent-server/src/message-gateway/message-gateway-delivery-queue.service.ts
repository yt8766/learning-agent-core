import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import type { ChannelOutboundMessage } from '@agent/core';

import { RuntimeHost } from '../runtime/core/runtime.host';
import type { ChannelDeliveryReceipt } from './interfaces/message-gateway.interface';
import { loadChannelDeliveries, saveChannelDeliveries } from './message-gateway-delivery-store';
import {
  buildChannelDeliveryHandler,
  createOutboundReceipts,
  processPendingOutboundReceipts
} from './message-gateway-delivery';

@Injectable()
export class MessageGatewayDeliveryQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly outboundQueue: ChannelDeliveryReceipt[] = [];
  private drainScheduled = false;
  private drainTimer?: NodeJS.Timeout;
  private initialized = false;
  private drainInFlight?: Promise<void>;
  private readonly deliverReceipt = buildChannelDeliveryHandler({
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramApiBaseUrl: process.env.TELEGRAM_API_BASE_URL,
    telegramMaxMessageLength: Number(process.env.TELEGRAM_MAX_MESSAGE_LENGTH || 3500)
  });

  constructor(@Inject(RuntimeHost) private readonly runtimeHost: RuntimeHost) {}

  async onModuleInit() {
    const persisted = await loadChannelDeliveries(this.runtimeHost.runtimeStateRepository);
    this.outboundQueue.splice(0, this.outboundQueue.length, ...persisted);
    this.initialized = true;
    await this.drain();
  }

  list(): ChannelDeliveryReceipt[] {
    return [...this.outboundQueue];
  }

  async enqueue(messages: ChannelOutboundMessage[]): Promise<ChannelDeliveryReceipt[]> {
    await this.ensureInitialized();
    const receipts = createOutboundReceipts(messages);
    this.outboundQueue.unshift(...receipts);
    if (this.outboundQueue.length > 200) {
      this.outboundQueue.length = 200;
    }
    await this.persist();
    this.scheduleDrain();
    await this.drain();
    return receipts;
  }

  onModuleDestroy() {
    if (this.drainTimer) {
      clearTimeout(this.drainTimer);
    }
  }

  private scheduleDrain() {
    if (this.drainScheduled) {
      return;
    }
    this.drainScheduled = true;
    this.drainTimer = setTimeout(() => {
      this.drainScheduled = false;
      void this.drain();
    }, 25);
  }

  private async drain() {
    if (this.drainInFlight) {
      await this.drainInFlight;
      return;
    }
    this.drainInFlight = (async () => {
      await this.ensureInitialized();
      await processPendingOutboundReceipts(this.outboundQueue, this.deliverReceipt);
      await this.persist();
    })();
    try {
      await this.drainInFlight;
    } finally {
      this.drainInFlight = undefined;
    }
  }

  private async ensureInitialized() {
    if (this.initialized) {
      return;
    }
    await this.onModuleInit();
  }

  private async persist() {
    await saveChannelDeliveries(this.runtimeHost.runtimeStateRepository, this.outboundQueue);
  }
}
