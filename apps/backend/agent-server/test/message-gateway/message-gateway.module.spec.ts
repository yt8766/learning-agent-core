import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { MessageGatewayModule } from '../../src/message-gateway/message-gateway.module';
import { MessageGatewayService } from '../../src/message-gateway/message-gateway.service';

describe('MessageGatewayModule', () => {
  it('能解析 gateway service，且 runtime 窄 facade 注入链有效', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MessageGatewayModule]
    }).compile();

    expect(moduleRef.get(MessageGatewayService)).toBeInstanceOf(MessageGatewayService);
  });
});
