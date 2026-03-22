import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [RuntimeModule],
  controllers: [AppController],
  providers: [AppService],
  exports: [AppService]
})
export class AppFeatureModule {}
