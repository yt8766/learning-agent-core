import type {
  GatewayAuthFileBatchUploadRequest,
  GatewayAuthFileBatchUploadResponse,
  GatewayAuthFileDeleteRequest,
  GatewayAuthFileDeleteResponse
} from '@agent/core';
import {
  arrayBody,
  arrayOfStrings,
  asRecord,
  mapBatchUploadAuthFiles,
  numberField,
  queryString,
  type RecordBody,
  stringField
} from './cli-proxy-management-client.helpers';
import type { CliProxyRequester } from './cli-proxy-management-client.request.helpers';

export async function uploadCliProxyAuthFiles(
  request: GatewayAuthFileBatchUploadRequest,
  requester: CliProxyRequester
): Promise<GatewayAuthFileBatchUploadResponse> {
  const accepted: GatewayAuthFileBatchUploadResponse['accepted'] = [];
  const rejected: GatewayAuthFileBatchUploadResponse['rejected'] = [];
  for (const file of request.files) {
    try {
      const content = Buffer.from(file.contentBase64, 'base64').toString('utf8');
      const { body } = await requester.requestJson(
        `/auth-files?name=${encodeURIComponent(file.fileName)}`,
        'POST',
        content,
        'application/json'
      );
      accepted.push(...mapBatchUploadAuthFiles(body, { files: [file] }).accepted);
    } catch (error) {
      rejected.push({ fileName: file.fileName, reason: error instanceof Error ? error.message : 'upload failed' });
    }
  }
  return { accepted, rejected };
}

export function buildCliProxyAuthFileDeleteRequest(request: GatewayAuthFileDeleteRequest): {
  path: string;
  bodyPayload?: string[];
} {
  return {
    path: request.all ? '/auth-files?all=true' : `/auth-files${queryString({ name: request.names?.[0] })}`,
    bodyPayload: request.all || request.names?.length === 1 ? undefined : request.names
  };
}

export function mapCliProxyAuthFileDeleteResponse(
  request: GatewayAuthFileDeleteRequest,
  body: RecordBody
): GatewayAuthFileDeleteResponse {
  const deletedCount = numberField(body, 'deleted');
  return {
    deleted: arrayOfStrings(body.files) ?? request.names ?? (deletedCount ? [`${deletedCount} files`] : []),
    skipped: arrayBody(body, 'failed', 'skipped').map(item => {
      const record = asRecord(item);
      return { name: stringField(record, 'name') ?? 'unknown', reason: stringField(record, 'error', 'reason') ?? '' };
    })
  };
}
