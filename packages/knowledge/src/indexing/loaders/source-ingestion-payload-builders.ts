import type { JsonObject, JsonValue } from '../../contracts/indexing/schemas/metadata.schema';
import type { KnowledgeTrustClass } from '../../contracts/types/knowledge-retrieval.types';
import { KnowledgeSourceIngestionPayloadSchema, type KnowledgeSourceIngestionPayload } from './source-ingestion-loader';

export interface UserUploadKnowledgePayloadInput {
  uploadId: string;
  filename: string;
  content: string;
  title?: string;
  uri?: string;
  version?: string;
  uploadedBy?: string;
  allowedRoles?: string[];
  mimeType?: string;
  metadata?: JsonObject;
}

export interface CatalogSyncKnowledgePayloadInput {
  catalogId: string;
  title: string;
  content: string;
  uri?: string;
  version?: string;
  owner?: string;
  trustClass?: Extract<KnowledgeTrustClass, 'official' | 'internal' | 'curated'>;
  metadata?: JsonObject;
}

export interface WebCuratedKnowledgePayloadInput {
  sourceId: string;
  url: string;
  title: string;
  content: string;
  version?: string;
  curatedBy?: string;
  trustClass?: Extract<KnowledgeTrustClass, 'curated' | 'official' | 'community' | 'unverified'>;
  metadata?: JsonObject;
}

export interface ConnectorSyncKnowledgePayloadInput {
  connectorId: string;
  documentId: string;
  title: string;
  content: string;
  uri: string;
  version?: string;
  capabilityId?: string;
  trustClass?: KnowledgeTrustClass;
  metadata?: JsonObject;
}

export function buildUserUploadKnowledgePayload(
  input: UserUploadKnowledgePayloadInput
): KnowledgeSourceIngestionPayload {
  return parsePayload({
    sourceId: input.uploadId,
    documentId: input.uploadId,
    sourceType: 'user-upload',
    uri: input.uri ?? `upload://${input.uploadId}/${input.filename}`,
    title: input.title ?? input.filename,
    trustClass: 'internal',
    content: input.content,
    version: input.version,
    metadata: compactMetadata({
      ...input.metadata,
      docType: input.metadata?.docType ?? 'user-upload',
      status: input.metadata?.status ?? 'active',
      originalFilename: input.filename,
      uploadedBy: input.uploadedBy,
      allowedRoles: input.allowedRoles,
      mimeType: input.mimeType
    })
  });
}

export function buildCatalogSyncKnowledgePayload(
  input: CatalogSyncKnowledgePayloadInput
): KnowledgeSourceIngestionPayload {
  return parsePayload({
    sourceId: `catalog-${input.catalogId}`,
    documentId: input.catalogId,
    sourceType: 'catalog-sync',
    uri: input.uri ?? `catalog://${input.catalogId}`,
    title: input.title,
    trustClass: input.trustClass ?? 'official',
    content: input.content,
    version: input.version,
    metadata: compactMetadata({
      ...input.metadata,
      docType: input.metadata?.docType ?? 'catalog-entry',
      status: input.metadata?.status ?? 'active',
      catalogId: input.catalogId,
      owner: input.owner
    })
  });
}

export function buildWebCuratedKnowledgePayload(
  input: WebCuratedKnowledgePayloadInput
): KnowledgeSourceIngestionPayload {
  return parsePayload({
    sourceId: input.sourceId,
    documentId: input.sourceId,
    sourceType: 'web-curated',
    uri: input.url,
    title: input.title,
    trustClass: input.trustClass ?? 'curated',
    content: input.content,
    version: input.version,
    metadata: compactMetadata({
      ...input.metadata,
      docType: input.metadata?.docType ?? 'curated-web',
      status: input.metadata?.status ?? 'active',
      curatedBy: input.curatedBy
    })
  });
}

export function buildConnectorSyncKnowledgePayload(
  input: ConnectorSyncKnowledgePayloadInput
): KnowledgeSourceIngestionPayload {
  return parsePayload({
    sourceId: `connector-${input.connectorId}-${input.documentId}`,
    documentId: input.documentId,
    sourceType: 'connector-manifest',
    uri: input.uri,
    title: input.title,
    trustClass: input.trustClass ?? 'internal',
    content: input.content,
    version: input.version,
    metadata: compactMetadata({
      ...input.metadata,
      docType: input.metadata?.docType ?? 'connector-sync',
      status: input.metadata?.status ?? 'active',
      connectorId: input.connectorId,
      capabilityId: input.capabilityId
    })
  });
}

function parsePayload(payload: KnowledgeSourceIngestionPayload): KnowledgeSourceIngestionPayload {
  return KnowledgeSourceIngestionPayloadSchema.parse(payload);
}

function compactMetadata(metadata: Record<string, JsonValue | undefined>): JsonObject {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined)) as JsonObject;
}
