import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';

import { AppController } from './app/app.controller';
import { AppService } from './app/app.service';
import { RuntimeService } from './runtime/runtime.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: RuntimeService,
          useValue: {
            describeGraph: () => ['Goal Intake']
          }
        }
      ]
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return health status payload', () => {
      expect(appController.health()).toMatchObject({
        status: 'ok',
        service: 'server'
      });
    });
  });
});
