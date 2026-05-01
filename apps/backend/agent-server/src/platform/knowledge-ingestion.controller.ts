import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';

import { KnowledgeSourceIngestionPayloadSchema, type JsonObject } from '@agent/knowledge';

import { RuntimeKnowledgeService } from '../runtime/services/runtime-knowledge.service';

const KnowledgeIngestionRequestSchema = z.object({
  payloads: z.array(KnowledgeSourceIngestionPayloadSchema).min(1)
});

const JsonObjectRequestSchema = z.record(z.string(), z.unknown()) as z.ZodType<JsonObject>;

const UserUploadIngestionRequestSchema = z.object({
  uploadId: z.string().min(1),
  filePath: z.string().min(1),
  filename: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  uploadedBy: z.string().min(1).optional(),
  allowedRoles: z.array(z.string().min(1)).optional(),
  mimeType: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  metadata: JsonObjectRequestSchema.optional()
});

const CatalogSyncIngestionEntrySchema = z.object({
  catalogId: z.string().min(1),
  title: z.string().min(1),
  content: z.string(),
  uri: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  owner: z.string().min(1).optional(),
  trustClass: z.enum(['official', 'internal', 'curated']).optional(),
  metadata: JsonObjectRequestSchema.optional()
});

const CatalogSyncIngestionRequestSchema = z.object({
  entries: z.array(CatalogSyncIngestionEntrySchema).min(1)
});

const WebCuratedIngestionEntrySchema = z.object({
  sourceId: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  content: z.string(),
  version: z.string().min(1).optional(),
  curatedBy: z.string().min(1).optional(),
  trustClass: z.enum(['curated', 'official', 'community', 'unverified']).optional(),
  metadata: JsonObjectRequestSchema.optional()
});

const WebCuratedIngestionRequestSchema = z.object({
  entries: z.array(WebCuratedIngestionEntrySchema).min(1)
});

const ConnectorSyncIngestionEntrySchema = z.object({
  connectorId: z.string().min(1),
  documentId: z.string().min(1),
  title: z.string().min(1),
  content: z.string(),
  uri: z.string().min(1),
  version: z.string().min(1).optional(),
  capabilityId: z.string().min(1).optional(),
  trustClass: z.enum(['official', 'curated', 'community', 'unverified', 'internal']).optional(),
  metadata: JsonObjectRequestSchema.optional()
});

const ConnectorSyncIngestionRequestSchema = z.object({
  entries: z.array(ConnectorSyncIngestionEntrySchema).min(1)
});

@Controller('platform/knowledge')
export class KnowledgeIngestionController {
  constructor(private readonly runtimeKnowledgeService: RuntimeKnowledgeService) {}

  @Post('sources/ingest')
  async ingestSources(@Body() body: unknown) {
    const request = parseKnowledgeIngestionRequest(body);
    return this.runtimeKnowledgeService.ingestKnowledgeSources(request.payloads);
  }

  @Post('sources/user-upload/ingest')
  async ingestUserUpload(@Body() body: unknown) {
    const request = parseUserUploadIngestionRequest(body);
    return this.runtimeKnowledgeService.ingestUserUploadSource(request);
  }

  @Post('sources/catalog-sync/ingest')
  async ingestCatalogSync(@Body() body: unknown) {
    const request = parseCatalogSyncIngestionRequest(body);
    return this.runtimeKnowledgeService.ingestCatalogSyncSources(request.entries);
  }

  @Post('sources/web-curated/ingest')
  async ingestWebCurated(@Body() body: unknown) {
    const request = parseWebCuratedIngestionRequest(body);
    return this.runtimeKnowledgeService.ingestWebCuratedSources(request.entries);
  }

  @Post('sources/connector-sync/ingest')
  async ingestConnectorSync(@Body() body: unknown) {
    const request = parseConnectorSyncIngestionRequest(body);
    return this.runtimeKnowledgeService.ingestConnectorSyncSources(request.entries);
  }
}

function parseKnowledgeIngestionRequest(body: unknown) {
  const parsed = KnowledgeIngestionRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'knowledge_ingestion_invalid_request',
      message: 'Invalid knowledge ingestion request.',
      issues: parsed.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    });
  }
  return parsed.data;
}

function parseCatalogSyncIngestionRequest(body: unknown) {
  const parsed = CatalogSyncIngestionRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'knowledge_catalog_sync_invalid_request',
      message: 'Invalid catalog sync knowledge ingestion request.',
      issues: parsed.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    });
  }
  return parsed.data;
}

function parseWebCuratedIngestionRequest(body: unknown) {
  const parsed = WebCuratedIngestionRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'knowledge_web_curated_invalid_request',
      message: 'Invalid web curated knowledge ingestion request.',
      issues: parsed.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    });
  }
  return parsed.data;
}

function parseConnectorSyncIngestionRequest(body: unknown) {
  const parsed = ConnectorSyncIngestionRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'knowledge_connector_sync_invalid_request',
      message: 'Invalid connector sync knowledge ingestion request.',
      issues: parsed.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    });
  }
  return parsed.data;
}

function parseUserUploadIngestionRequest(body: unknown) {
  const parsed = UserUploadIngestionRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'knowledge_user_upload_invalid_request',
      message: 'Invalid user upload knowledge ingestion request.',
      issues: parsed.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    });
  }
  return parsed.data;
}
