import { request, type AdminRequestInit } from './admin-api-core';

type AdminFacadeFetch = (path: string, init?: AdminRequestInit) => Promise<unknown>;

export type AutoReviewGateDisplayRecord = Record<string, unknown> & {
  gateId: string;
  status: string;
  decision: string;
  reasonCode?: string;
  requiresApproval: boolean;
};

export type AutoReviewReviewerDisplayRecord = Record<string, unknown> & {
  reviewerId: string;
  reviewerKind: string;
  displayName?: string;
  version?: string;
};

export type AutoReviewRecord = Record<string, unknown> & {
  reviewId: string;
  taskId: string;
  kind: string;
  status: string;
  verdict: string;
  summary: string;
  findings: unknown[];
  evidenceIds: string[];
  artifactIds: string[];
  gate?: AutoReviewGateDisplayRecord;
  reviewer?: AutoReviewReviewerDisplayRecord;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export async function createAutoReview(input: Record<string, unknown>, fetcher: AdminFacadeFetch = request) {
  return parseAutoReview(
    await fetcher('/auto-review/reviews', {
      method: 'POST',
      body: JSON.stringify(input)
    })
  );
}

export async function listAutoReviews(
  query: Record<string, string | undefined> = {},
  fetcher: AdminFacadeFetch = request
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }
  const queryString = params.toString();
  return parseAutoReviews(await fetcher(queryString ? `/auto-review/reviews?${queryString}` : '/auto-review/reviews'));
}

export async function getAutoReview(reviewId: string, fetcher: AdminFacadeFetch = request) {
  return parseAutoReview(await fetcher(`/auto-review/reviews/${encodeURIComponent(reviewId)}`));
}

export async function rerunAutoReview(
  reviewId: string,
  input: Record<string, unknown>,
  fetcher: AdminFacadeFetch = request
) {
  return parseAutoReview(
    await fetcher(`/auto-review/reviews/${encodeURIComponent(reviewId)}/rerun`, {
      method: 'POST',
      body: JSON.stringify(input)
    })
  );
}

export async function resumeAutoReviewApproval(
  reviewId: string,
  input: Record<string, unknown>,
  fetcher: AdminFacadeFetch = request
) {
  return parseAutoReview(
    await fetcher(`/auto-review/reviews/${encodeURIComponent(reviewId)}/approval`, {
      method: 'POST',
      body: JSON.stringify(input)
    })
  );
}

function parseAutoReviews(payload: unknown): AutoReviewRecord[] {
  const sanitized = stripRawVendorPayloadFields(payload);
  if (!Array.isArray(sanitized) || !sanitized.every(isAutoReviewRecord)) {
    throw new Error('Auto review list response did not match the expected contract');
  }
  return sanitized;
}

function parseAutoReview(payload: unknown): AutoReviewRecord {
  const sanitized = stripRawVendorPayloadFields(payload);
  if (!isAutoReviewRecord(sanitized)) {
    throw new Error('Auto review response did not match the expected contract');
  }
  return sanitized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isAutoReviewRecord(value: unknown): value is AutoReviewRecord {
  return (
    isRecord(value) &&
    isNonEmptyString(value.reviewId) &&
    isNonEmptyString(value.taskId) &&
    isNonEmptyString(value.kind) &&
    isNonEmptyString(value.status) &&
    ['allow', 'warn', 'block', 'unknown'].includes(String(value.verdict)) &&
    isNonEmptyString(value.summary) &&
    Array.isArray(value.findings) &&
    isStringArray(value.evidenceIds) &&
    isStringArray(value.artifactIds) &&
    (value.gate === undefined || isAutoReviewGateDisplayRecord(value.gate)) &&
    (value.reviewer === undefined || isAutoReviewReviewerDisplayRecord(value.reviewer)) &&
    (value.metadata === undefined || isRecord(value.metadata)) &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt)
  );
}

function isAutoReviewGateDisplayRecord(value: unknown): value is AutoReviewGateDisplayRecord {
  return (
    isRecord(value) &&
    isNonEmptyString(value.gateId) &&
    isNonEmptyString(value.status) &&
    ['allow', 'warn', 'block', 'unknown'].includes(String(value.decision)) &&
    (value.reasonCode === undefined || isNonEmptyString(value.reasonCode)) &&
    typeof value.requiresApproval === 'boolean'
  );
}

function isAutoReviewReviewerDisplayRecord(value: unknown): value is AutoReviewReviewerDisplayRecord {
  return (
    isRecord(value) &&
    isNonEmptyString(value.reviewerId) &&
    isNonEmptyString(value.reviewerKind) &&
    (value.displayName === undefined || isNonEmptyString(value.displayName)) &&
    (value.version === undefined || isNonEmptyString(value.version))
  );
}

function stripRawVendorPayloadFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripRawVendorPayloadFields);
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isRawVendorPayloadKey(key))
      .map(([key, item]) => [key, stripRawVendorPayloadFields(item)])
  );
}

function isRawVendorPayloadKey(key: string): boolean {
  return [
    'vendorPayload',
    'rawVendorPayload',
    'vendorObject',
    'vendorResponse',
    'rawVendorResponse',
    'providerResponse',
    'rawProviderResponse'
  ].includes(key);
}
