import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { AutoReviewService } from './auto-review.service';
import type { AutoReviewListQuery } from './auto-review.types';

@Controller('auto-review')
export class AutoReviewController {
  constructor(private readonly autoReviewService: AutoReviewService) {}

  @Post('reviews')
  createReview(@Body() body: unknown) {
    return this.autoReviewService.createReview(body);
  }

  @Get('reviews')
  listReviews(@Query() query: AutoReviewListQuery) {
    return this.autoReviewService.listReviews(query);
  }

  @Get('reviews/:reviewId')
  getReview(@Param('reviewId') reviewId: string) {
    return this.autoReviewService.getReview(reviewId);
  }

  @Post('reviews/:reviewId/rerun')
  rerunReview(@Param('reviewId') reviewId: string, @Body() body: unknown) {
    return this.autoReviewService.rerunReview(reviewId, body);
  }

  @Post('reviews/:reviewId/approval')
  resumeApproval(@Param('reviewId') reviewId: string, @Body() body: unknown) {
    return this.autoReviewService.resumeApproval(reviewId, body);
  }
}
