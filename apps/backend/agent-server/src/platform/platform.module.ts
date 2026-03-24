import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { PlatformController } from './platform.controller';

@Module({
  imports: [RuntimeModule],
  controllers: [PlatformController]
})
export class PlatformModule {}
