import { Module } from '@nestjs/common';

import { AutoReviewController } from './auto-review.controller';
import { AutoReviewRepository } from './auto-review.repository';
import { AutoReviewService } from './auto-review.service';

@Module({
  controllers: [AutoReviewController],
  providers: [AutoReviewRepository, AutoReviewService],
  exports: [AutoReviewService]
})
export class AutoReviewModule {}
