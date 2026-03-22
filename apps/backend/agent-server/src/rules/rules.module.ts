import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';

@Module({
  imports: [RuntimeModule],
  controllers: [RulesController],
  providers: [RulesService]
})
export class RulesModule {}
