import { Injectable } from '@nestjs/common';
import { AutoReviewResultSchema } from '@agent/tools';
import { z } from 'zod/v4';

import type { AutoReviewRecord } from './auto-review.types';

export interface AutoReviewRepositorySnapshot {
  reviews: AutoReviewRecord[];
}

@Injectable()
export class AutoReviewRepository {
  private readonly reviews = new Map<string, AutoReviewRecord>();

  saveReview(review: AutoReviewRecord): AutoReviewRecord {
    const parsed = cloneReview(review);
    this.reviews.set(parsed.reviewId, parsed);
    return cloneReview(parsed);
  }

  getReview(reviewId: string): AutoReviewRecord | undefined {
    const review = this.reviews.get(reviewId);
    return review ? cloneReview(review) : undefined;
  }

  listReviews(): AutoReviewRecord[] {
    return [...this.reviews.values()].map(cloneReview);
  }

  exportSnapshot(): AutoReviewRepositorySnapshot {
    return { reviews: this.listReviews() };
  }

  restoreSnapshot(snapshot: AutoReviewRepositorySnapshot): void {
    const parsed = AutoReviewRepositorySnapshotSchema.parse(snapshot);
    this.reviews.clear();
    for (const review of parsed.reviews) {
      this.saveReview(review);
    }
  }
}

function cloneReview(review: AutoReviewRecord): AutoReviewRecord {
  return AutoReviewResultSchema.parse(structuredClone(review));
}

const AutoReviewRepositorySnapshotSchema = z
  .object({
    reviews: z.array(AutoReviewResultSchema)
  })
  .strict();
