export type GatewayErrorCode =
  | 'AUTH_ERROR'
  | 'KEY_DISABLED'
  | 'KEY_EXPIRED'
  | 'MODEL_NOT_FOUND'
  | 'MODEL_NOT_ALLOWED'
  | 'RATE_LIMITED'
  | 'BUDGET_EXCEEDED'
  | 'CONTEXT_TOO_LONG'
  | 'UPSTREAM_AUTH_ERROR'
  | 'UPSTREAM_RATE_LIMITED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_BAD_RESPONSE';

export class GatewayError extends Error {
  readonly code: GatewayErrorCode;
  readonly status: number;

  constructor(code: GatewayErrorCode, message: string, status: number) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
    this.status = status;
  }
}

export function toGatewayError(error: unknown): GatewayError {
  if (error instanceof GatewayError) {
    return error;
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    if (code === 'UPSTREAM_UNAVAILABLE') {
      return new GatewayError('UPSTREAM_UNAVAILABLE', 'Upstream provider is unavailable', 503);
    }
  }

  return new GatewayError('UPSTREAM_BAD_RESPONSE', 'Gateway request failed', 400);
}

export function gatewayErrorResponse(error: unknown): Response {
  const gatewayError = toGatewayError(error);

  return Response.json(
    {
      error: {
        code: gatewayError.code,
        message: gatewayError.message,
        type: 'gateway_error'
      }
    },
    { status: gatewayError.status }
  );
}
