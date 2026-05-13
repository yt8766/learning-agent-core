import type { GatewayOpenAIErrorType } from '../../runtime/agent-gateway-openai-error';

interface GatewayRuntimeExecutorErrorOptions {
  code: string;
  type: GatewayOpenAIErrorType;
  message: string;
  statusCode: number;
  retryable: boolean;
  cause?: unknown;
}

export class GatewayRuntimeExecutorError extends Error {
  readonly code: string;
  readonly type: GatewayOpenAIErrorType;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(options: GatewayRuntimeExecutorErrorOptions) {
    super(options.message);
    this.name = 'GatewayRuntimeExecutorError';
    this.code = options.code;
    this.type = options.type;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable;
    this.cause = options.cause;
  }
}
