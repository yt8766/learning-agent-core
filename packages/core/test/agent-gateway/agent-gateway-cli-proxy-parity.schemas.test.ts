import { describe, expect, it } from 'vitest';
import {
  GatewayAmpcodeConfigResponseSchema,
  GatewayAmpcodeModelMappingSchema,
  GatewayAmpcodeUpstreamApiKeyMappingSchema,
  GatewayApiKeyListResponseSchema,
  GatewayApiKeySchema,
  GatewayAuthFileBatchUploadRequestSchema,
  GatewayAuthFileBatchUploadResponseSchema,
  GatewayAuthFileListResponseSchema,
  GatewayAuthFileModelListResponseSchema,
  GatewayAuthFilePatchRequestSchema,
  GatewayConfigDiffResponseSchema,
  GatewayConnectionProfileSchema,
  GatewayConnectionStatusResponseSchema,
  GatewayCreateApiKeyRequestSchema,
  GatewayDashboardSummaryResponseSchema,
  GatewayLogFileListResponseSchema,
  GatewayManagementApiCallRequestSchema,
  GatewayManagementApiCallResponseSchema,
  GatewayOAuthModelAliasListResponseSchema,
  GatewayOAuthModelAliasRuleSchema,
  GatewayOAuthModelAliasesResponseSchema,
  GatewayOAuthPolicySchema,
  GatewayProviderOAuthStartRequestSchema,
  GatewayProviderOAuthStartResponseSchema,
  GatewayProviderConfigListResponseSchema,
  GatewayProviderConfigSchema,
  GatewayProviderSpecificConfigListResponseSchema,
  GatewayProviderSpecificConfigRecordSchema,
  GatewayQuotaDetailListResponseSchema,
  GatewayRawConfigResponseSchema,
  GatewayReloadConfigResponseSchema,
  GatewayRequestLogListResponseSchema,
  GatewaySaveConnectionProfileRequestSchema,
  GatewaySaveRawConfigRequestSchema,
  GatewaySystemModelsResponseSchema,
  GatewaySystemVersionResponseSchema,
  GatewayUpdateApiKeyRequestSchema,
  GatewayUpdateOAuthModelAliasRulesRequestSchema,
  GatewayUpdateOAuthModelAliasesRequestSchema,
  GatewayUpdateOAuthPolicyRequestSchema,
  GatewayUpsertProviderConfigRequestSchema,
  GatewayVertexCredentialImportRequestSchema,
  GatewayVertexCredentialImportResponseSchema
} from '../../src/contracts/agent-gateway';

describe('agent gateway CLI Proxy parity contracts', () => {
  it('parses remote management connection contracts', () => {
    expect(
      GatewaySaveConnectionProfileRequestSchema.parse({
        apiBase: 'https://remote.router-for.me/v0/management',
        managementKey: 'mgmt-secret',
        timeoutMs: 15000
      })
    ).toEqual({
      apiBase: 'https://remote.router-for.me/v0/management',
      managementKey: 'mgmt-secret',
      timeoutMs: 15000
    });

    expect(
      GatewayConnectionProfileSchema.parse({
        apiBase: 'https://remote.router-for.me/v0/management',
        managementKeyMasked: 'mgm***ret',
        timeoutMs: 15000,
        updatedAt: '2026-05-08T00:00:00.000Z'
      })
    ).toMatchObject({ managementKeyMasked: 'mgm***ret' });

    expect(
      GatewayConnectionStatusResponseSchema.parse({
        status: 'connected',
        checkedAt: '2026-05-08T00:00:01.000Z',
        serverVersion: '1.2.3',
        serverBuildDate: '2026-05-01'
      })
    ).toMatchObject({ status: 'connected' });
  });

  it('parses raw config file contracts', () => {
    expect(
      GatewayRawConfigResponseSchema.parse({
        content: 'debug: true\nrequest-retry: 2\n',
        format: 'yaml',
        version: 'config-1'
      })
    ).toMatchObject({ format: 'yaml' });

    expect(
      GatewaySaveRawConfigRequestSchema.parse({
        content: 'debug: false\nrequest-retry: 3\n',
        expectedVersion: 'config-1'
      })
    ).toMatchObject({ expectedVersion: 'config-1' });

    expect(
      GatewayConfigDiffResponseSchema.parse({
        changed: true,
        before: 'debug: true\n',
        after: 'debug: false\n'
      })
    ).toMatchObject({ changed: true });

    expect(
      GatewayReloadConfigResponseSchema.parse({
        reloaded: true,
        reloadedAt: '2026-05-08T00:00:02.000Z'
      })
    ).toMatchObject({ reloaded: true });
  });

  it('parses API key management contracts', () => {
    expect(
      GatewayCreateApiKeyRequestSchema.parse({
        name: 'ci smoke key',
        scopes: ['management:read', 'models:list'],
        expiresAt: '2026-06-01T00:00:00.000Z'
      })
    ).toMatchObject({ name: 'ci smoke key' });

    expect(
      GatewayApiKeySchema.parse({
        id: 'key-1',
        name: 'ci smoke key',
        prefix: 'sk-test',
        status: 'active',
        scopes: ['management:read'],
        createdAt: '2026-05-08T00:00:00.000Z',
        lastUsedAt: null,
        expiresAt: null,
        usage: {
          requestCount: 7,
          lastRequestAt: '2026-05-08T00:03:00.000Z'
        }
      })
    ).toMatchObject({ prefix: 'sk-test', usage: { requestCount: 7 } });

    expect(
      GatewayUpdateApiKeyRequestSchema.parse({
        keyId: 'key-1',
        name: 'renamed key',
        status: 'disabled',
        scopes: ['management:read']
      })
    ).toMatchObject({ keyId: 'key-1', status: 'disabled' });

    expect(
      GatewayApiKeyListResponseSchema.parse({
        items: [
          {
            id: 'key-1',
            name: 'ci smoke key',
            prefix: 'sk-test',
            status: 'active',
            scopes: ['management:read'],
            createdAt: '2026-05-08T00:00:00.000Z',
            lastUsedAt: null,
            expiresAt: null,
            usage: { requestCount: 0, lastRequestAt: null }
          }
        ]
      }).items
    ).toHaveLength(1);
  });

  it('parses provider config contracts', () => {
    expect(
      GatewayProviderConfigSchema.parse({
        providerId: 'gemini-main',
        kind: 'gemini',
        displayName: 'Gemini Main',
        enabled: true,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        models: ['gemini-2.5-pro'],
        timeoutMs: 60000,
        maxRetries: 2,
        settings: {
          projectId: 'agent-prod',
          quotaProject: 'agent-quota'
        },
        updatedAt: '2026-05-08T00:00:00.000Z'
      })
    ).toMatchObject({ kind: 'gemini', settings: { projectId: 'agent-prod' } });

    expect(
      GatewayUpsertProviderConfigRequestSchema.parse({
        providerId: 'openai-compatible-main',
        kind: 'openai-compatible',
        displayName: 'OpenAI compatible',
        enabled: true,
        baseUrl: 'https://router.example.com/v1',
        models: ['router/default'],
        timeoutMs: 45000,
        maxRetries: 1,
        settings: { organization: 'org-1' }
      })
    ).toMatchObject({ kind: 'openai-compatible' });

    expect(
      GatewayProviderConfigListResponseSchema.parse({
        items: [
          {
            providerId: 'codex-main',
            kind: 'codex',
            displayName: 'Codex',
            enabled: true,
            baseUrl: null,
            models: ['gpt-5.1-codex'],
            timeoutMs: 120000,
            maxRetries: 0,
            settings: {},
            updatedAt: '2026-05-08T00:00:00.000Z'
          }
        ]
      }).items[0].kind
    ).toBe('codex');
  });

  it('parses dashboard summary contracts', () => {
    expect(
      GatewayDashboardSummaryResponseSchema.parse({
        observedAt: '2026-05-09T00:00:00.000Z',
        connection: {
          status: 'connected',
          apiBase: 'https://remote.router-for.me/v0/management',
          serverVersion: '1.2.3',
          serverBuildDate: '2026-05-01'
        },
        counts: {
          managementApiKeys: 3,
          authFiles: 4,
          providerCredentials: 6,
          availableModels: 21
        },
        providers: [
          {
            providerKind: 'vertex',
            configured: true,
            enabled: 2,
            disabled: 1,
            modelCount: 8
          }
        ],
        routing: {
          strategy: 'round-robin',
          forceModelPrefix: true,
          requestRetry: 2,
          wsAuth: false,
          proxyUrl: null
        },
        latestVersion: '1.2.4',
        updateAvailable: true
      }).providers[0].providerKind
    ).toBe('vertex');
  });

  it('parses provider-specific config records', () => {
    expect(
      GatewayProviderSpecificConfigRecordSchema.parse({
        providerType: 'openaiCompatible',
        id: 'openai-main',
        displayName: 'OpenAI Main',
        enabled: true,
        baseUrl: 'https://api.openai.com/v1',
        priority: 1,
        prefix: 'openai',
        proxyUrl: null,
        headers: { 'x-team': 'platform' },
        models: [{ name: 'gpt-5.4', alias: 'gpt-main', priority: 1, testModel: 'gpt-5.4' }],
        excludedModels: ['bad-model'],
        credentials: [{ credentialId: 'key-1', apiKeyMasked: 'sk-***abc', status: 'valid' }],
        cloakPolicy: { strictMode: true, sensitiveWords: ['secret'] },
        authIndex: 'openai-main-0',
        rawSource: 'adapter'
      })
    ).toMatchObject({ providerType: 'openaiCompatible', models: [{ alias: 'gpt-main' }] });

    expect(
      GatewayProviderSpecificConfigListResponseSchema.parse({
        items: [
          {
            providerType: 'vertex',
            id: 'vertex-main',
            displayName: 'Vertex Main',
            enabled: true,
            baseUrl: 'https://us-central1-aiplatform.googleapis.com',
            proxyUrl: null,
            models: [{ name: 'gemini-2.5-pro', fork: true }],
            excludedModels: [],
            credentials: [{ credentialId: 'vertex-1', status: 'valid', authIndex: 'vertex-0' }]
          }
        ]
      }).items[0].models[0].fork
    ).toBe(true);
  });

  it('parses auth file batch and model list contracts', () => {
    expect(
      GatewayAuthFileBatchUploadRequestSchema.parse({
        files: [
          {
            fileName: 'gemini.json',
            contentBase64: 'eyJ0eXBlIjoic2VydmljZV9hY2NvdW50In0=',
            providerKind: 'gemini'
          }
        ]
      }).files
    ).toHaveLength(1);

    expect(
      GatewayAuthFileBatchUploadResponseSchema.parse({
        accepted: [
          {
            authFileId: 'auth-1',
            fileName: 'gemini.json',
            providerKind: 'gemini',
            status: 'valid'
          }
        ],
        rejected: [
          {
            fileName: 'bad.txt',
            reason: 'unsupported extension'
          }
        ]
      })
    ).toMatchObject({ accepted: [{ authFileId: 'auth-1' }] });

    expect(
      GatewayAuthFileListResponseSchema.parse({
        items: [
          {
            id: 'auth-1',
            providerId: 'gemini-main',
            providerKind: 'gemini',
            fileName: 'gemini.json',
            path: '/secure/gemini.json',
            status: 'valid',
            accountEmail: 'agent@example.com',
            projectId: 'agent-prod',
            modelCount: 2,
            updatedAt: '2026-05-08T00:00:00.000Z',
            metadata: { region: 'us-central1' }
          }
        ],
        nextCursor: null
      }).items[0].providerKind
    ).toBe('gemini');

    expect(
      GatewayAuthFilePatchRequestSchema.parse({
        authFileId: 'auth-1',
        providerId: 'gemini-main',
        accountEmail: 'agent@example.com',
        projectId: 'agent-prod',
        status: 'valid'
      })
    ).toMatchObject({ authFileId: 'auth-1' });

    expect(
      GatewayAuthFileModelListResponseSchema.parse({
        authFileId: 'auth-1',
        models: [
          {
            id: 'gemini-2.5-pro',
            displayName: 'Gemini 2.5 Pro',
            providerKind: 'gemini',
            available: true
          }
        ]
      }).models[0].available
    ).toBe(true);
  });

  it('parses OAuth policy and model alias contracts', () => {
    expect(
      GatewayOAuthPolicySchema.parse({
        providerId: 'codex-main',
        enabled: true,
        callbackUrl: 'https://gateway.example.com/oauth/callback',
        excludedModels: ['gpt-5.1-codex-mini'],
        allowedDomains: ['example.com'],
        updatedAt: '2026-05-08T00:00:00.000Z'
      })
    ).toMatchObject({ enabled: true });

    expect(
      GatewayUpdateOAuthPolicyRequestSchema.parse({
        providerId: 'codex-main',
        enabled: false,
        excludedModels: ['gpt-5.1-codex-mini'],
        allowedDomains: []
      })
    ).toMatchObject({ providerId: 'codex-main', enabled: false });

    expect(
      GatewayOAuthModelAliasRuleSchema.parse({
        channel: 'codex',
        sourceModel: 'gpt-5.4',
        alias: 'gpt-main',
        fork: true
      })
    ).toMatchObject({ fork: true });

    expect(
      GatewayOAuthModelAliasesResponseSchema.parse({
        providerId: 'codex-main',
        aliases: {
          'codex/default': 'gpt-5.1-codex'
        },
        updatedAt: '2026-05-08T00:00:00.000Z'
      }).aliases['codex/default']
    ).toBe('gpt-5.1-codex');

    expect(
      GatewayOAuthModelAliasListResponseSchema.parse({
        providerId: 'codex-main',
        modelAliases: [
          {
            channel: 'codex',
            sourceModel: 'gpt-5.4',
            alias: 'gpt-main',
            fork: true
          }
        ],
        updatedAt: '2026-05-08T00:00:00.000Z'
      }).modelAliases[0].fork
    ).toBe(true);

    expect(
      GatewayUpdateOAuthModelAliasesRequestSchema.parse({
        providerId: 'codex-main',
        aliases: {
          'codex/default': 'gpt-5.1-codex'
        }
      })
    ).toMatchObject({ providerId: 'codex-main' });

    expect(
      GatewayUpdateOAuthModelAliasRulesRequestSchema.parse({
        providerId: 'codex-main',
        modelAliases: [
          {
            channel: 'codex',
            sourceModel: 'gpt-5.4',
            alias: 'gpt-main',
            fork: false
          }
        ]
      }).modelAliases?.[0].fork
    ).toBe(false);

    expect(
      GatewayProviderOAuthStartRequestSchema.parse({
        provider: 'codex',
        isWebui: true
      })
    ).toMatchObject({ provider: 'codex', isWebui: true });

    expect(
      GatewayProviderOAuthStartResponseSchema.parse({
        state: 'codex-state',
        verificationUri: 'https://auth.openai.com/oauth/authorize?state=codex-state',
        expiresAt: '2026-05-08T00:15:00.000Z'
      })
    ).toMatchObject({ state: 'codex-state' });
  });

  it('parses Vertex credential import contracts', () => {
    expect(
      GatewayVertexCredentialImportRequestSchema.parse({
        fileName: 'vertex-service-account.json',
        contentBase64: 'eyJwcm9qZWN0X2lkIjoiYWdlbnQtcHJvZCJ9',
        location: 'us-central1'
      })
    ).toMatchObject({ location: 'us-central1' });

    expect(
      GatewayVertexCredentialImportResponseSchema.parse({
        status: 'ok',
        projectId: 'agent-prod',
        email: 'vertex-sa@agent-prod.iam.gserviceaccount.com',
        location: 'us-central1',
        authFile: 'vertex-service-account.json',
        authFileId: 'auth-vertex-1'
      })
    ).toMatchObject({ status: 'ok', projectId: 'agent-prod' });
  });

  it('parses management api-call proxy contracts', () => {
    expect(
      GatewayManagementApiCallRequestSchema.parse({
        authIndex: 'openai-main-0',
        method: 'GET',
        url: 'https://api.openai.com/v1/models',
        header: {
          Authorization: 'Bearer sk-***'
        }
      })
    ).toMatchObject({ method: 'GET', authIndex: 'openai-main-0' });

    expect(
      GatewayManagementApiCallResponseSchema.parse({
        statusCode: 200,
        header: {
          'content-type': ['application/json']
        },
        bodyText: '{"data":[{"id":"gpt-5.4"}]}',
        body: {
          data: [{ id: 'gpt-5.4' }]
        },
        durationMs: 180
      }).header['content-type']
    ).toEqual(['application/json']);
  });

  it('parses Ampcode upstream and model mapping contracts', () => {
    expect(
      GatewayAmpcodeUpstreamApiKeyMappingSchema.parse({
        upstreamApiKeyMasked: 'amp-***key',
        upstreamSecretRef: 'secret://ampcode/upstream-1',
        apiKeys: ['sk-proxy-1', 'sk-proxy-2']
      }).apiKeys
    ).toHaveLength(2);

    expect(
      GatewayAmpcodeModelMappingSchema.parse({
        from: 'gpt-5.4',
        to: 'amp/gpt-5.4',
        enabled: true
      })
    ).toMatchObject({ from: 'gpt-5.4', to: 'amp/gpt-5.4' });

    expect(
      GatewayAmpcodeConfigResponseSchema.parse({
        upstreamUrl: 'https://ampcode.example.com/v1',
        upstreamApiKeyMasked: 'amp-***key',
        forceModelMappings: true,
        upstreamApiKeys: [
          {
            upstreamApiKeyMasked: 'amp-***key',
            upstreamSecretRef: 'secret://ampcode/upstream-1',
            apiKeys: ['sk-proxy-1']
          }
        ],
        modelMappings: [{ from: 'gpt-5.4', to: 'amp/gpt-5.4', enabled: true }],
        updatedAt: '2026-05-09T00:00:00.000Z'
      }).forceModelMappings
    ).toBe(true);
  });

  it('parses provider quota detail contracts', () => {
    expect(
      GatewayQuotaDetailListResponseSchema.parse({
        items: [
          {
            id: 'quota-gemini-pro-daily',
            providerId: 'gemini-main',
            model: 'gemini-2.5-pro',
            scope: 'daily',
            window: '1d',
            limit: 1000,
            used: 125,
            remaining: 875,
            resetAt: '2026-05-09T00:00:00.000Z',
            refreshedAt: '2026-05-08T00:00:00.000Z',
            status: 'normal'
          }
        ]
      }).items[0].remaining
    ).toBe(875);
  });

  it('parses log files and request logs contracts', () => {
    expect(
      GatewayLogFileListResponseSchema.parse({
        items: [
          {
            fileName: 'access.log',
            path: '/var/log/cli-proxy/access.log',
            sizeBytes: 2048,
            modifiedAt: '2026-05-08T00:00:00.000Z',
            downloadUrl: '/agent-gateway/logs/files/access.log'
          }
        ]
      }).items[0].sizeBytes
    ).toBe(2048);

    expect(
      GatewayRequestLogListResponseSchema.parse({
        items: [
          {
            id: 'req-1',
            occurredAt: '2026-05-08T00:00:00.000Z',
            method: 'POST',
            path: '/v1/chat/completions',
            statusCode: 200,
            durationMs: 312,
            managementTraffic: false,
            providerId: 'gemini-main',
            apiKeyPrefix: 'sk-test',
            message: 'proxied request'
          }
        ],
        total: 1,
        nextCursor: null
      }).items[0].managementTraffic
    ).toBe(false);
  });

  it('parses system model and version contracts', () => {
    expect(
      GatewaySystemVersionResponseSchema.parse({
        version: '1.2.3',
        latestVersion: '1.2.4',
        buildDate: '2026-05-01',
        updateAvailable: true,
        links: {
          documentation: 'https://docs.example.com/cli-proxy',
          releaseNotes: 'https://docs.example.com/cli-proxy/releases'
        }
      })
    ).toMatchObject({ updateAvailable: true });

    expect(
      GatewaySystemModelsResponseSchema.parse({
        groups: [
          {
            providerId: 'gemini-main',
            providerKind: 'gemini',
            models: [
              {
                id: 'gemini-2.5-pro',
                displayName: 'Gemini 2.5 Pro',
                providerKind: 'gemini',
                available: true,
                aliases: ['gemini/default']
              }
            ]
          }
        ]
      }).groups[0].models[0].aliases
    ).toEqual(['gemini/default']);
  });
});
