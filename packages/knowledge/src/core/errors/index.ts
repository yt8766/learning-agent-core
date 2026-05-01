import type { JsonObject } from '../types';

export type KnowledgeErrorCategory =
  | 'validation'
  | 'ingestion'
  | 'retrieval'
  | 'generation'
  | 'provider'
  | 'evaluation'
  | 'authorization';

export interface KnowledgeErrorOptions {
  code: string;
  category?: KnowledgeErrorCategory;
  retryable?: boolean;
  details?: JsonObject;
  cause?: unknown;
}

export class KnowledgeError extends Error {
  readonly code: string;
  readonly category: KnowledgeErrorCategory;
  readonly retryable: boolean;
  readonly details?: JsonObject;
  readonly cause?: unknown;

  constructor(message: string, options: KnowledgeErrorOptions) {
    super(message);
    this.name = 'KnowledgeError';
    this.code = options.code;
    this.category = options.category ?? 'provider';
    this.retryable = options.retryable ?? false;
    this.details = options.details;
    this.cause = options.cause;
  }
}

export class KnowledgeValidationError extends KnowledgeError {
  constructor(message: string, options: Omit<KnowledgeErrorOptions, 'category'>) {
    super(message, { ...options, category: 'validation' });
    this.name = 'KnowledgeValidationError';
  }
}

export interface KnowledgeProviderErrorOptions extends Omit<KnowledgeErrorOptions, 'category'> {
  providerId: string;
}

export class KnowledgeProviderError extends KnowledgeError {
  readonly providerId: string;

  constructor(message: string, options: KnowledgeProviderErrorOptions) {
    super(message, { ...options, category: 'provider' });
    this.name = 'KnowledgeProviderError';
    this.providerId = options.providerId;
  }
}
