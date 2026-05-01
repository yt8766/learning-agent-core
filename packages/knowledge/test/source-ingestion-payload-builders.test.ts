import { describe, expect, it } from 'vitest';

import {
  buildCatalogSyncKnowledgePayload,
  buildConnectorSyncKnowledgePayload,
  buildUserUploadKnowledgePayload,
  buildWebCuratedKnowledgePayload,
  KnowledgeSourceIngestionPayloadSchema
} from '../src';

describe('source ingestion payload builders', () => {
  it('normalizes user upload artifacts into validated ingestion payloads', () => {
    const payload = buildUserUploadKnowledgePayload({
      uploadId: 'upload-1',
      filename: 'policy.md',
      content: 'uploaded policy content',
      uploadedBy: 'admin@example.com',
      allowedRoles: ['admin'],
      metadata: {
        status: 'active'
      }
    });

    expect(KnowledgeSourceIngestionPayloadSchema.parse(payload)).toEqual(
      expect.objectContaining({
        sourceId: 'upload-1',
        sourceType: 'user-upload',
        uri: 'upload://upload-1/policy.md',
        title: 'policy.md',
        trustClass: 'internal',
        content: 'uploaded policy content',
        metadata: expect.objectContaining({
          docType: 'user-upload',
          status: 'active',
          originalFilename: 'policy.md',
          uploadedBy: 'admin@example.com',
          allowedRoles: ['admin']
        })
      })
    );
  });

  it('normalizes catalog, curated web, and connector sync artifacts with source-specific metadata', () => {
    const catalog = buildCatalogSyncKnowledgePayload({
      catalogId: 'service-runtime',
      title: 'Runtime Service',
      content: 'runtime service owner and SLA',
      uri: 'catalog://services/runtime',
      version: 'v2',
      owner: 'runtime-team'
    });
    const web = buildWebCuratedKnowledgePayload({
      sourceId: 'web-opensearch',
      url: 'https://example.com/opensearch',
      title: 'OpenSearch Guide',
      content: 'curated opensearch deployment guide',
      curatedBy: 'researcher@example.com'
    });
    const connector = buildConnectorSyncKnowledgePayload({
      connectorId: 'github',
      documentId: 'github-repo-1',
      title: 'Repository README',
      content: 'repository readme from connector sync',
      uri: 'connector://github/repo-1',
      trustClass: 'internal',
      capabilityId: 'github.read'
    });

    expect(catalog).toEqual(
      expect.objectContaining({
        sourceId: 'catalog-service-runtime',
        sourceType: 'catalog-sync',
        trustClass: 'official',
        version: 'v2',
        metadata: expect.objectContaining({
          docType: 'catalog-entry',
          owner: 'runtime-team'
        })
      })
    );
    expect(web).toEqual(
      expect.objectContaining({
        sourceId: 'web-opensearch',
        sourceType: 'web-curated',
        uri: 'https://example.com/opensearch',
        trustClass: 'curated',
        metadata: expect.objectContaining({
          docType: 'curated-web',
          curatedBy: 'researcher@example.com'
        })
      })
    );
    expect(connector).toEqual(
      expect.objectContaining({
        sourceId: 'connector-github-github-repo-1',
        documentId: 'github-repo-1',
        sourceType: 'connector-manifest',
        metadata: expect.objectContaining({
          docType: 'connector-sync',
          connectorId: 'github',
          capabilityId: 'github.read'
        })
      })
    );

    expect(() => KnowledgeSourceIngestionPayloadSchema.parse(catalog)).not.toThrow();
    expect(() => KnowledgeSourceIngestionPayloadSchema.parse(web)).not.toThrow();
    expect(() => KnowledgeSourceIngestionPayloadSchema.parse(connector)).not.toThrow();
  });
});
