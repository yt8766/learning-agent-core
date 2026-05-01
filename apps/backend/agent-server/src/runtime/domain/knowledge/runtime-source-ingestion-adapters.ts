import { basename, isAbsolute, relative, resolve } from 'node:path';

import { BadRequestException } from '@nestjs/common';
import fs from 'fs-extra';
import {
  buildCatalogSyncKnowledgePayload,
  buildConnectorSyncKnowledgePayload,
  buildWebCuratedKnowledgePayload,
  buildUserUploadKnowledgePayload,
  type JsonObject,
  type KnowledgeSourceIngestionPayload
} from '@agent/knowledge';

export interface RuntimeUserUploadKnowledgeIngestionInput {
  uploadId: string;
  filePath: string;
  filename?: string;
  title?: string;
  uploadedBy?: string;
  allowedRoles?: string[];
  mimeType?: string;
  version?: string;
  metadata?: JsonObject;
}

export interface RuntimeCatalogSyncKnowledgeIngestionInput {
  catalogId: string;
  title: string;
  content: string;
  uri?: string;
  version?: string;
  owner?: string;
  trustClass?: 'official' | 'internal' | 'curated';
  metadata?: JsonObject;
}

export interface RuntimeWebCuratedKnowledgeIngestionInput {
  sourceId: string;
  url: string;
  title: string;
  content: string;
  version?: string;
  curatedBy?: string;
  trustClass?: 'curated' | 'official' | 'community' | 'unverified';
  metadata?: JsonObject;
}

export interface RuntimeConnectorSyncKnowledgeIngestionInput {
  connectorId: string;
  documentId: string;
  title: string;
  content: string;
  uri: string;
  version?: string;
  capabilityId?: string;
  trustClass?: 'official' | 'curated' | 'community' | 'unverified' | 'internal';
  metadata?: JsonObject;
}

export async function buildUserUploadKnowledgePayloadFromWorkspace(
  settings: { workspaceRoot: string },
  input: RuntimeUserUploadKnowledgeIngestionInput
): Promise<KnowledgeSourceIngestionPayload> {
  const filePath = await resolveWorkspaceFilePath(settings.workspaceRoot, input.filePath);
  const fileStat = await fs.stat(filePath).catch(error => {
    throw toUserUploadFileError(input.filePath, error);
  });
  if (!fileStat.isFile()) {
    throw new BadRequestException({
      code: 'knowledge_user_upload_invalid_file',
      message: 'User upload ingestion requires a regular file.'
    });
  }
  const filename = input.filename ?? basename(filePath);
  const content = await fs.readFile(filePath, 'utf8');

  return buildUserUploadKnowledgePayload({
    uploadId: input.uploadId,
    filename,
    title: input.title,
    content,
    version: input.version ?? `${fileStat.mtimeMs}:${fileStat.size}`,
    uploadedBy: input.uploadedBy,
    allowedRoles: input.allowedRoles,
    mimeType: input.mimeType,
    metadata: input.metadata
  });
}

export function buildCatalogSyncKnowledgePayloads(
  entries: readonly RuntimeCatalogSyncKnowledgeIngestionInput[]
): KnowledgeSourceIngestionPayload[] {
  return entries.map(entry => buildCatalogSyncKnowledgePayload(entry));
}

export function buildWebCuratedKnowledgePayloads(
  entries: readonly RuntimeWebCuratedKnowledgeIngestionInput[]
): KnowledgeSourceIngestionPayload[] {
  return entries.map(entry => buildWebCuratedKnowledgePayload(entry));
}

export function buildConnectorSyncKnowledgePayloads(
  entries: readonly RuntimeConnectorSyncKnowledgeIngestionInput[]
): KnowledgeSourceIngestionPayload[] {
  return entries.map(entry => buildConnectorSyncKnowledgePayload(entry));
}

async function resolveWorkspaceFilePath(workspaceRoot: string, filePath: string) {
  const workspaceRealPath = await fs.realpath(workspaceRoot);
  const candidatePath = isAbsolute(filePath) ? filePath : resolve(workspaceRealPath, filePath);
  const candidateRealPath = await fs.realpath(candidatePath).catch(error => {
    throw toUserUploadFileError(filePath, error);
  });
  const relativePath = relative(workspaceRealPath, candidateRealPath);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new BadRequestException({
      code: 'knowledge_user_upload_path_outside_workspace',
      message: 'User upload file must be inside the configured workspace root.'
    });
  }
  return candidateRealPath;
}

function toUserUploadFileError(filePath: string, error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined;
  if (code === 'ENOENT') {
    return new BadRequestException({
      code: 'knowledge_user_upload_file_not_found',
      message: 'User upload file was not found.',
      filePath
    });
  }
  return error;
}
