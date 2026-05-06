import { createRequire } from 'node:module';
import { Injectable } from '@nestjs/common';

import { KnowledgeServiceError } from '../knowledge.errors';
import type {
  OssListObjectsInput,
  OssListObjectsResult,
  OssPutObjectInput,
  OssPutObjectResult,
  OssStorageProvider,
  OssStoredObject
} from './oss-storage.provider';

const AliOssClient = createRequire(__filename)('ali-oss') as AliOssConstructor;

export interface AliyunOssStorageProviderOptions {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  client?: AliOssClient;
  endpoint?: string;
  publicBaseUrl?: string;
  region?: string;
}

interface AliOssConstructor {
  new (options: AliOssClientOptions): AliOssClient;
}

interface AliOssClientOptions {
  accessKeyId: string;
  accessKeySecret: string;
  authorizationV4: boolean;
  bucket: string;
  endpoint?: string;
  region?: string;
}

interface AliOssClient {
  delete(name: string): Promise<unknown>;
  get(name: string): Promise<{ content: Buffer | string | Uint8Array; res?: { headers?: Record<string, string> } }>;
  list(query?: Record<string, string | number | undefined>): Promise<{
    objects?: Array<{ lastModified?: string; name: string; size?: number }>;
    isTruncated?: boolean;
    nextMarker?: string;
  }>;
  put(
    name: string,
    file: Buffer,
    options?: { headers?: Record<string, string>; meta?: Record<string, string> }
  ): Promise<{
    name?: string;
    url?: string;
  }>;
}

@Injectable()
export class AliyunOssStorageProvider implements OssStorageProvider {
  private readonly bucket: string;
  private readonly client: AliOssClient;
  private readonly publicBaseUrl?: string;

  constructor(options: AliyunOssStorageProviderOptions) {
    if (!options.client && !options.region) {
      throw new KnowledgeServiceError('knowledge_upload_oss_failed', 'OSS region is required when using ali-oss V4');
    }
    this.bucket = options.bucket;
    this.client =
      options.client ??
      new AliOssClient({
        accessKeyId: options.accessKeyId,
        accessKeySecret: options.accessKeySecret,
        authorizationV4: true,
        bucket: options.bucket,
        endpoint: options.endpoint,
        region: options.region
      });
    this.publicBaseUrl = options.publicBaseUrl ? trimTrailingSlash(options.publicBaseUrl) : undefined;
  }

  async putObject(input: OssPutObjectInput): Promise<OssPutObjectResult> {
    try {
      const result = await this.client.put(input.objectKey, Buffer.from(input.body), {
        headers: {
          'Content-Disposition': 'attachment',
          'Content-Type': input.contentType,
          'x-oss-forbid-overwrite': 'true',
          'x-oss-object-acl': 'private',
          'x-oss-storage-class': 'Standard'
        },
        meta: toHeaderSafeMetadata(input.metadata)
      });
      return {
        objectKey: input.objectKey,
        ossUrl: this.publicObjectUrl(input.objectKey, result.url)
      };
    } catch (error) {
      throw toStorageError(error, 'OSS 上传失败');
    }
  }

  async getObject(objectKey: string): Promise<OssStoredObject | undefined> {
    try {
      const result = await this.client.get(objectKey);
      const headers = normalizeHeaders(result.res?.headers);
      return {
        objectKey,
        body: Buffer.from(result.content),
        contentType: headers['content-type'] ?? 'application/octet-stream',
        metadata: readResponseMetadata(headers)
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return undefined;
      }
      throw toStorageError(error, 'OSS 读取失败');
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    try {
      await this.client.delete(objectKey);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw toStorageError(error, 'OSS 删除失败');
      }
    }
  }

  async listObjects(input: OssListObjectsInput = {}): Promise<OssListObjectsResult> {
    try {
      const query: Record<string, string | number | undefined> = {
        marker: input.marker,
        'max-keys': input.maxKeys,
        prefix: input.prefix
      };
      const result = await this.client.list(query);
      return {
        items: (result.objects ?? []).map(object => ({
          objectKey: object.name,
          lastModified: object.lastModified,
          size: object.size
        })),
        isTruncated: Boolean(result.isTruncated),
        nextMarker: result.nextMarker
      };
    } catch (error) {
      throw toStorageError(error, 'OSS 列举失败');
    }
  }

  private publicObjectUrl(objectKey: string, sdkUrl?: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${encodeObjectKey(objectKey)}`;
    }
    return sdkUrl ?? `oss://${this.bucket}/${objectKey}`;
  }
}

export function createAliyunOssStorageProviderFromEnv(env: NodeJS.ProcessEnv): AliyunOssStorageProvider | undefined {
  const requestedProvider = env.KNOWLEDGE_OSS_PROVIDER;
  const bucket = env.ALIYUN_OSS_BUCKET;
  const accessKeyId = env.ALIYUN_OSS_ACCESS_KEY_ID ?? env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = env.ALIYUN_OSS_ACCESS_KEY_SECRET ?? env.OSS_ACCESS_KEY_SECRET;
  const region = env.ALIYUN_OSS_REGION;
  const endpoint = env.ALIYUN_OSS_ENDPOINT;
  if (
    !requestedProvider &&
    !bucket &&
    !accessKeyId &&
    !accessKeySecret &&
    !region &&
    !endpoint &&
    !env.ALIYUN_OSS_PUBLIC_BASE_URL
  ) {
    return undefined;
  }
  if (requestedProvider && requestedProvider !== 'aliyun' && requestedProvider !== 'memory') {
    throw new KnowledgeServiceError(
      'knowledge_upload_oss_config_invalid',
      'OSS 配置不正确：KNOWLEDGE_OSS_PROVIDER 只支持 aliyun 或 memory'
    );
  }
  if (requestedProvider === 'memory') {
    return undefined;
  }
  if (!bucket || !accessKeyId || !accessKeySecret || !region) {
    throw new KnowledgeServiceError(
      'knowledge_upload_oss_config_invalid',
      'OSS 配置不完整：需要 ALIYUN_OSS_BUCKET、ALIYUN_OSS_REGION、ALIYUN_OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_ID、ALIYUN_OSS_ACCESS_KEY_SECRET/OSS_ACCESS_KEY_SECRET'
    );
  }
  return new AliyunOssStorageProvider({
    accessKeyId,
    accessKeySecret,
    bucket,
    endpoint,
    publicBaseUrl: env.ALIYUN_OSS_PUBLIC_BASE_URL,
    region
  });
}

export function describeAliyunOssEnv(env: NodeJS.ProcessEnv): string {
  const bucket = env.ALIYUN_OSS_BUCKET ? 'set' : 'missing';
  const region = env.ALIYUN_OSS_REGION ? env.ALIYUN_OSS_REGION : 'missing';
  const endpoint = env.ALIYUN_OSS_ENDPOINT ? env.ALIYUN_OSS_ENDPOINT : 'default';
  const accessKeyId = env.ALIYUN_OSS_ACCESS_KEY_ID || env.OSS_ACCESS_KEY_ID ? 'set' : 'missing';
  const accessKeySecret = env.ALIYUN_OSS_ACCESS_KEY_SECRET || env.OSS_ACCESS_KEY_SECRET ? 'set' : 'missing';
  return `bucket=${bucket} region=${region} endpoint=${endpoint} accessKeyId=${accessKeyId} accessKeySecret=${accessKeySecret}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
}

function readResponseMetadata(headers: Record<string, string>): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.startsWith('x-oss-meta-')) {
      metadata[key.slice('x-oss-meta-'.length)] = value;
    }
  }
  return metadata;
}

function encodeObjectKey(objectKey: string): string {
  return objectKey.split('/').map(encodeURIComponent).join('/');
}

function toHeaderSafeMetadata(metadata: Record<string, string> | undefined): Record<string, string> {
  const safeMetadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    safeMetadata[key] = /[^\x20-\x7E]/.test(value) ? encodeURIComponent(value) : value;
  }
  return safeMetadata;
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as { code?: unknown; status?: unknown };
  return candidate.status === 404 || candidate.code === 'NoSuchKey' || candidate.code === 'NoSuchObject';
}

function toStorageError(error: unknown, fallbackMessage: string): KnowledgeServiceError {
  const status =
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
      ? `：HTTP ${(error as { status: number }).status}`
      : '';
  const code =
    error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
      ? ` ${(error as { code: string }).code}`
      : '';
  const requestId =
    error &&
    typeof error === 'object' &&
    'requestId' in error &&
    typeof (error as { requestId?: unknown }).requestId === 'string'
      ? ` requestId=${(error as { requestId: string }).requestId}`
      : '';
  const message =
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
      ? ` ${(error as { message: string }).message}`
      : '';
  const cause = readErrorCauseMessage(error);
  return new KnowledgeServiceError(
    'knowledge_upload_oss_failed',
    `${fallbackMessage}${status}${code}${requestId}${message}${cause}`
  );
}

function readErrorCauseMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('cause' in error)) {
    return '';
  }
  const cause = (error as { cause?: unknown }).cause;
  if (!cause || typeof cause !== 'object' || !('message' in cause)) {
    return '';
  }
  const message = (cause as { message?: unknown }).message;
  return typeof message === 'string' ? ` cause=${message}` : '';
}
