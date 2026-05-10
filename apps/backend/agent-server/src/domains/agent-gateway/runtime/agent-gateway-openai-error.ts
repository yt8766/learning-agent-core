export type GatewayOpenAIErrorType =
  | 'invalid_request_error'
  | 'authentication_error'
  | 'permission_error'
  | 'rate_limit_error'
  | 'api_error';

export function openAIError(code: string, message: string, type: GatewayOpenAIErrorType) {
  return { error: { message, type, code } };
}
