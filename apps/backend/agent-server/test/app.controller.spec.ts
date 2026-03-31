import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';

import { AppController } from '../src/app/app.controller';
import { AppService } from '../src/app/app.service';
import { RuntimeTaskService } from '../src/runtime/services/runtime-task.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: RuntimeTaskService,
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
