import { Inject, Injectable } from '@nestjs/common';
import type {
  GatewayAuthFile,
  GatewayAuthFileBatchUploadRequest,
  GatewayAuthFileBatchUploadResponse,
  GatewayAuthFileListResponse,
  GatewayAuthFileModelListResponse,
  GatewayAuthFilePatchRequest
} from '@agent/core';
import {
  GatewayAuthFileBatchUploadResponseSchema,
  GatewayAuthFileDeleteResponseSchema,
  GatewayAuthFileListResponseSchema,
  GatewayAuthFileModelListResponseSchema,
  GatewayAuthFileSchema
} from '@agent/core';
import type { AgentGatewayManagementClient } from '../management/agent-gateway-management-client';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';

export interface GatewayAuthFileListQuery {
  query?: string;
  providerKind?: string;
  cursor?: string;
  limit?: number;
}

export interface GatewayAuthFileDeleteRequest {
  names?: string[];
  all?: boolean;
}

export interface GatewayAuthFileDeleteResponse {
  deleted: string[];
  skipped: Array<{ name: string; reason: string }>;
}

interface AuthFileManagementClient {
  listAuthFiles?(query: GatewayAuthFileListQuery): Promise<GatewayAuthFileListResponse>;
  batchUploadAuthFiles?(request: GatewayAuthFileBatchUploadRequest): Promise<GatewayAuthFileBatchUploadResponse>;
  patchAuthFileFields?(request: GatewayAuthFilePatchRequest): Promise<GatewayAuthFile>;
  listAuthFileModels?(authFileId: string): Promise<GatewayAuthFileModelListResponse>;
  downloadAuthFile?(authFileId: string): Promise<string>;
  deleteAuthFiles?(request: GatewayAuthFileDeleteRequest): Promise<GatewayAuthFileDeleteResponse>;
}

const fixedNow = '2026-05-09T00:00:00.000Z';

@Injectable()
export class AgentGatewayAuthFileManagementService {
  private readonly authFiles = new Map<string, GatewayAuthFile>();
  private readonly contents = new Map<string, string>();

  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  async list(query: GatewayAuthFileListQuery): Promise<GatewayAuthFileListResponse> {
    const delegate = this.delegate();
    if (delegate.listAuthFiles) {
      const response = await delegate.listAuthFiles(query);
      return GatewayAuthFileListResponseSchema.parse({
        ...response,
        items: response.items.map(cloneAuthFile)
      });
    }
    const needle = query.query?.trim().toLowerCase();
    const items = [...this.authFiles.values()].filter(item => {
      if (query.providerKind && item.providerKind !== query.providerKind) return false;
      if (!needle) return true;
      return item.fileName.toLowerCase().includes(needle) || item.providerId.toLowerCase().includes(needle);
    });
    const limit = normalizeLimit(query.limit, 100);
    return GatewayAuthFileListResponseSchema.parse({
      items: items.slice(0, limit).map(cloneAuthFile),
      nextCursor: null
    });
  }

  async batchUpload(request: GatewayAuthFileBatchUploadRequest): Promise<GatewayAuthFileBatchUploadResponse> {
    return this.uploadAuthFiles(request);
  }

  async uploadAuthFiles(request: GatewayAuthFileBatchUploadRequest): Promise<GatewayAuthFileBatchUploadResponse> {
    const delegate = this.delegate();
    if (delegate.batchUploadAuthFiles) {
      return GatewayAuthFileBatchUploadResponseSchema.parse(await delegate.batchUploadAuthFiles(request));
    }

    const accepted = request.files.map(file => {
      const providerKind = file.providerKind ?? 'custom';
      const authFile: GatewayAuthFile = {
        id: file.fileName,
        providerId: providerKind,
        providerKind,
        fileName: file.fileName,
        path: `/auth-files/${file.fileName}`,
        status: 'valid',
        accountEmail: null,
        projectId: null,
        modelCount: 1,
        updatedAt: fixedNow,
        metadata: {}
      };
      this.authFiles.set(authFile.id, authFile);
      this.contents.set(authFile.id, decodeBase64(file.contentBase64));
      return {
        authFileId: authFile.id,
        fileName: authFile.fileName,
        providerKind: authFile.providerKind,
        status: authFile.status
      };
    });

    return GatewayAuthFileBatchUploadResponseSchema.parse({ accepted, rejected: [] });
  }

  async patchFields(request: GatewayAuthFilePatchRequest): Promise<GatewayAuthFile> {
    const delegate = this.delegate();
    if (delegate.patchAuthFileFields)
      return GatewayAuthFileSchema.parse(cloneAuthFile(await delegate.patchAuthFileFields(request)));
    const current = this.authFiles.get(request.authFileId) ?? createMissingAuthFile(request.authFileId);
    const next: GatewayAuthFile = {
      ...current,
      providerId: request.providerId ?? current.providerId,
      accountEmail: request.accountEmail === undefined ? current.accountEmail : request.accountEmail,
      projectId: request.projectId === undefined ? current.projectId : request.projectId,
      authIndex: request.authIndex === undefined ? current.authIndex : request.authIndex,
      disabled: request.disabled ?? current.disabled,
      headers: request.headers ?? current.headers,
      note: request.note === undefined ? current.note : request.note,
      prefix: request.prefix === undefined ? current.prefix : request.prefix,
      priority: request.priority ?? current.priority,
      proxyUrl: request.proxyUrl === undefined ? current.proxyUrl : request.proxyUrl,
      status: request.status ?? current.status,
      metadata: { ...(current.metadata ?? {}), ...(request.metadata ?? {}) },
      updatedAt: fixedNow
    };
    this.authFiles.set(next.id, next);
    return GatewayAuthFileSchema.parse(cloneAuthFile(next));
  }

  async models(authFileId: string): Promise<GatewayAuthFileModelListResponse> {
    const delegate = this.delegate();
    if (delegate.listAuthFileModels) {
      return GatewayAuthFileModelListResponseSchema.parse(await delegate.listAuthFileModels(authFileId));
    }
    const authFile = this.authFiles.get(authFileId) ?? createMissingAuthFile(authFileId);
    return GatewayAuthFileModelListResponseSchema.parse({
      authFileId,
      models: [
        {
          id: `${authFile.providerKind}-default`,
          displayName: `${authFile.providerKind} default`,
          providerKind: authFile.providerKind,
          available: true
        }
      ]
    });
  }

  async download(authFileId: string): Promise<string> {
    const delegate = this.delegate();
    if (delegate.downloadAuthFile) return delegate.downloadAuthFile(authFileId);
    const content = this.contents.get(authFileId);
    return content === undefined ? authFileId : `${authFileId}\n${content}`;
  }

  async delete(request: GatewayAuthFileDeleteRequest): Promise<GatewayAuthFileDeleteResponse> {
    const delegate = this.delegate();
    if (delegate.deleteAuthFiles)
      return GatewayAuthFileDeleteResponseSchema.parse(await delegate.deleteAuthFiles(request));
    const names = request.all ? [...this.authFiles.keys()] : (request.names ?? []);
    const deleted: string[] = [];
    const skipped: Array<{ name: string; reason: string }> = [];
    for (const name of names) {
      if (this.authFiles.delete(name)) {
        this.contents.delete(name);
        deleted.push(name);
      } else {
        skipped.push({ name, reason: 'not_found' });
      }
    }
    return GatewayAuthFileDeleteResponseSchema.parse({ deleted, skipped });
  }

  private delegate(): AuthFileManagementClient {
    return this.managementClient as AuthFileManagementClient;
  }
}

function createMissingAuthFile(authFileId: string): GatewayAuthFile {
  return {
    id: authFileId,
    providerId: 'custom',
    providerKind: 'custom',
    fileName: authFileId,
    path: `/auth-files/${authFileId}`,
    status: 'missing',
    accountEmail: null,
    projectId: null,
    modelCount: 0,
    updatedAt: fixedNow,
    metadata: {}
  };
}

function cloneAuthFile(file: GatewayAuthFile): GatewayAuthFile {
  return { ...file, metadata: file.metadata ? sanitizeMetadata(file.metadata) : undefined };
}

function sanitizeMetadata(
  metadata: NonNullable<GatewayAuthFile['metadata']>
): NonNullable<GatewayAuthFile['metadata']> {
  return Object.fromEntries(
    Object.entries(metadata).flatMap(([key, value]) => {
      if (isSensitiveProjectionKey(key)) return [];
      if (isProjectionValue(value)) return [[key, value]];
      return [];
    })
  );
}

function isProjectionValue(value: unknown): value is string | number | boolean | null {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function isSensitiveProjectionKey(key: string): boolean {
  return /(?:api[-_]?key|access[-_]?token|refresh[-_]?token|authorization|cookie|secret)/i.test(key);
}

function decodeBase64(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value && value > 0 ? Math.min(Math.floor(value), 500) : fallback;
}
