import { request, type AdminRequestInit } from './admin-api-core';

type AdminFacadeFetch = (path: string, init?: AdminRequestInit) => Promise<unknown>;

export type SandboxProfileRecord = Record<string, unknown> & { profile: string };
export type SandboxRunRecord = Record<string, unknown> & {
  runId: string;
  taskId: string;
  profile: string;
  stage: string;
  status: string;
  attempt: number;
  maxAttempts: number;
};
export type SandboxPreflightResponse = Record<string, unknown> & {
  decision: string;
  reasonCode: string;
  reason: string;
  profile: string;
  normalizedPermissionScope: Record<string, unknown>;
  requiresApproval: boolean;
};
export type ExecuteSandboxCommandRequest = Record<string, unknown> & {
  taskId: string;
  command: string;
  profile?: string;
  timeoutMs?: number;
};

export async function listSandboxProfiles(fetcher: AdminFacadeFetch = request) {
  return parseSandboxProfiles(await fetcher('/sandbox/profiles'));
}

export async function preflightSandboxRun(input: Record<string, unknown>, fetcher: AdminFacadeFetch = request) {
  return parseSandboxPreflightResponse(
    await fetcher('/sandbox/preflight', {
      method: 'POST',
      body: JSON.stringify(input)
    })
  );
}

export async function executeSandboxCommand(input: ExecuteSandboxCommandRequest, fetcher: AdminFacadeFetch = request) {
  return parseSandboxRun(
    await fetcher('/sandbox/execute', {
      method: 'POST',
      body: JSON.stringify(input)
    })
  );
}

export async function getSandboxRun(runId: string, fetcher: AdminFacadeFetch = request) {
  return parseSandboxRun(await fetcher(`/sandbox/runs/${encodeURIComponent(runId)}`));
}

export async function cancelSandboxRun(
  runId: string,
  input: Record<string, unknown>,
  fetcher: AdminFacadeFetch = request
) {
  return parseSandboxRun(
    await fetcher(`/sandbox/runs/${encodeURIComponent(runId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify(input)
    })
  );
}

export async function resumeSandboxRunApproval(
  runId: string,
  input: Record<string, unknown>,
  fetcher: AdminFacadeFetch = request
) {
  return parseSandboxRun(
    await fetcher(`/sandbox/runs/${encodeURIComponent(runId)}/approval`, {
      method: 'POST',
      body: JSON.stringify(input)
    })
  );
}

function parseSandboxProfiles(payload: unknown): SandboxProfileRecord[] {
  if (!Array.isArray(payload) || !payload.every(isSandboxProfileRecord)) {
    throw new Error('Sandbox profiles response did not match the expected contract');
  }
  return payload;
}

function parseSandboxRun(payload: unknown): SandboxRunRecord {
  if (!isSandboxRunRecord(payload)) {
    throw new Error('Sandbox run response did not match the expected contract');
  }
  return stripRawVendorPayloadFields(payload) as SandboxRunRecord;
}

function parseSandboxPreflightResponse(payload: unknown): SandboxPreflightResponse {
  if (!isSandboxPreflightResponse(payload)) {
    throw new Error('Sandbox preflight response did not match the expected contract');
  }
  return payload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isSandboxProfileRecord(value: unknown): value is SandboxProfileRecord {
  return isRecord(value) && isNonEmptyString(value.profile);
}

function isSandboxRunRecord(value: unknown): value is SandboxRunRecord {
  return (
    isRecord(value) &&
    isNonEmptyString(value.runId) &&
    isNonEmptyString(value.taskId) &&
    isNonEmptyString(value.profile) &&
    isNonEmptyString(value.stage) &&
    isNonEmptyString(value.status) &&
    typeof value.attempt === 'number' &&
    typeof value.maxAttempts === 'number'
  );
}

function isSandboxPreflightResponse(value: unknown): value is SandboxPreflightResponse {
  return (
    isRecord(value) &&
    ['allow', 'require_approval', 'deny'].includes(String(value.decision)) &&
    isNonEmptyString(value.reasonCode) &&
    isNonEmptyString(value.reason) &&
    isNonEmptyString(value.profile) &&
    isRecord(value.normalizedPermissionScope) &&
    typeof value.requiresApproval === 'boolean' &&
    (value.run === undefined || isSandboxRunRecord(value.run))
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
