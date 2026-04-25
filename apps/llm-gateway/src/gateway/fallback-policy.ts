import { GatewayError } from './errors';
import { GatewayProviderError } from '../providers/provider-adapter';

const FALLBACK_ELIGIBLE_GATEWAY_ERROR_CODES = new Set([
  'UPSTREAM_TIMEOUT',
  'UPSTREAM_RATE_LIMITED',
  'UPSTREAM_UNAVAILABLE',
  'UPSTREAM_BAD_RESPONSE'
]);

export function isFallbackEligible(error: unknown): boolean {
  if (error instanceof GatewayProviderError) {
    return true;
  }

  if (!(error instanceof GatewayError)) {
    return false;
  }

  return FALLBACK_ELIGIBLE_GATEWAY_ERROR_CODES.has(error.code);
}
