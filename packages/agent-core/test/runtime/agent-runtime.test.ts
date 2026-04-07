import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { AgentRuntime } from '../../src/runtime/agent-runtime';

describe('AgentRuntime', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('assembles shared vector and knowledge search services with explicit local index paths', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agent-runtime-vector-'));

    const runtime = new AgentRuntime({
      settings: {
        profile: 'platform',
        workspaceRoot: tempDir,
        memoryFilePath: join(tempDir, 'memory', 'records.jsonl'),
        rulesFilePath: join(tempDir, 'rules', 'rules.jsonl'),
        vectorIndexFilePath: join(tempDir, 'memory', 'vector-index.json'),
        tasksStateFilePath: join(tempDir, 'runtime', 'tasks-state.json'),
        semanticCacheFilePath: join(tempDir, 'runtime', 'semantic-cache.json'),
        skillsRoot: join(tempDir, 'skills'),
        pluginsLabRoot: join(tempDir, 'plugins-lab'),
        skillSourcesRoot: join(tempDir, 'skill-sources'),
        skillPackagesRoot: join(tempDir, 'skill-packages'),
        skillReceiptsRoot: join(tempDir, 'skill-receipts'),
        skillInternalRoot: join(tempDir, 'skill-internal'),
        registryFilePath: join(tempDir, 'skills', 'registry.json'),
        knowledgeRoot: join(tempDir, 'knowledge'),
        port: 3000,
        llmProvider: 'zhipu',
        zhipuApiKey: 'token',
        zhipuApiBaseUrl: '',
        zhipuModels: {
          manager: 'glm-5',
          research: 'glm-4.7-flashx',
          executor: 'glm-4.6',
          reviewer: 'glm-4.7'
        },
        zhipuThinking: {
          manager: true,
          research: false,
          executor: false,
          reviewer: true
        },
        providers: [],
        routing: {},
        policy: {
          approvalMode: 'balanced',
          skillInstallMode: 'manual',
          learningMode: 'controlled',
          sourcePolicyMode: 'controlled-first',
          budget: {
            stepBudget: 8,
            retryBudget: 1,
            sourceBudget: 8,
            maxCostPerTaskUsd: 2,
            fallbackModelId: 'glm-4.7-flash'
          },
          memoryPolicy: { localFirst: true },
          learningPolicy: {
            autoLearnPreferences: true,
            autoLearnHeuristics: true,
            autoLearnTaskExperience: false,
            requireConfirmationOnConflict: true
          },
          approvalPolicy: {
            safeWriteAutoApprove: true,
            destructiveActionRequireApproval: true
          },
          suggestionPolicy: {
            expertAdviceDefault: true,
            autoSearchSkillsOnGap: true
          }
        },
        contextStrategy: {
          maxTokens: 12000,
          recentTurns: 10,
          summaryInterval: 8,
          ragTopK: 4,
          compressionModel: 'glm-4.7-flashx',
          compressionEnabled: true,
          compressionMessageThreshold: 15,
          compressionKeepRecentMessages: 5,
          compressionKeepLeadingMessages: 10,
          compressionMaxSummaryChars: 1200
        },
        runtimeBackground: {
          enabled: true,
          workerPoolSize: 2,
          leaseTtlMs: 30000,
          heartbeatMs: 10000,
          pollMs: 3000,
          runnerIdPrefix: 'runtime'
        },
        dailyTechBriefing: {
          enabled: false,
          schedule: 'daily 11:00',
          sendEmptyDigest: false,
          maxItemsPerCategory: 5,
          duplicateWindowDays: 7,
          maxNonCriticalItemsPerCategory: 10,
          maxCriticalItemsPerCategory: 20,
          maxTotalItemsPerCategory: 30,
          sendOnlyDelta: true,
          resendOnlyOnMaterialChange: true,
          larkDigestMode: 'dual',
          larkDetailMode: 'detailed',
          sourcePolicy: 'tiered-authority',
          webhookEnvVar: 'LARK_BOT_WEBHOOK_URL',
          translationEnabled: false,
          translationModel: 'glm-4.7-flashx',
          aiLookbackDays: 7,
          frontendLookbackDays: 7,
          securityLookbackDays: 7,
          categories: {
            frontendSecurity: {
              enabled: true,
              baseIntervalHours: 4,
              lookbackDays: 3,
              adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [2, 4, 8] }
            },
            generalSecurity: {
              enabled: true,
              baseIntervalHours: 4,
              lookbackDays: 7,
              adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [2, 4, 8] }
            },
            devtoolSecurity: {
              enabled: true,
              baseIntervalHours: 4,
              lookbackDays: 7,
              adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [2, 4, 8] }
            },
            aiTech: {
              enabled: true,
              baseIntervalHours: 24,
              lookbackDays: 7,
              adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [12, 24, 48] }
            },
            frontendTech: {
              enabled: true,
              baseIntervalHours: 24,
              lookbackDays: 7,
              adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [12, 24, 48] }
            },
            backendTech: {
              enabled: true,
              baseIntervalHours: 24,
              lookbackDays: 7,
              adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [12, 24, 48] }
            },
            cloudInfraTech: {
              enabled: true,
              baseIntervalHours: 24,
              lookbackDays: 7,
              adaptivePolicy: { hotThresholdRuns: 2, cooldownEmptyRuns: 6, allowedIntervalHours: [12, 24, 48] }
            }
          }
        },
        embeddings: {
          provider: 'glm',
          model: 'Embedding-3',
          dimensions: 3,
          endpoint: 'https://example.com/embeddings'
        },
        mcp: {
          bigmodelApiKey: 'token',
          webSearchEndpoint: '',
          webReaderEndpoint: '',
          zreadEndpoint: '',
          researchHttpEndpoint: '',
          researchHttpApiKey: '',
          visionMode: 'ZHIPU',
          stdioSessionIdleTtlMs: 300000,
          stdioSessionMaxCount: 4
        },
        providerAudit: {
          primaryProvider: 'zhipu',
          adapters: []
        }
      } as any,
      llmProvider: {
        isConfigured: () => false,
        generateText: async () => '',
        streamText: async () => '',
        generateObject: async () => ({})
      } as any
    });

    expect(runtime.vectorIndexRepository).toBeDefined();
    expect(runtime.knowledgeSearchService).toBeDefined();
    expect(runtime.settings.vectorIndexFilePath).toBe(join(tempDir, 'memory', 'vector-index.json'));
  });
});
