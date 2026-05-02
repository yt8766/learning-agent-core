import type { KnowledgeServiceErrorCode } from '@agent/core';

export class KnowledgeServiceError extends Error {
  constructor(
    readonly code: KnowledgeServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'KnowledgeServiceError';
  }
}
