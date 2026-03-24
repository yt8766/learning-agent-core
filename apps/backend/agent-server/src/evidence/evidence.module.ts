import { Module } from '@nestjs/common';

import { RuntimeModule } from '../runtime/runtime.module';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

@Module({
  imports: [RuntimeModule],
  controllers: [EvidenceController],
  providers: [EvidenceService]
})
export class EvidenceModule {}
