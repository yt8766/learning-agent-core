import type { DailyTechBriefingConfig, RuntimeSettings, RuntimeSettingsOverrides } from './settings.types';

export function buildDailyTechBriefingCategoryConfig(
  runtimeEnv: NodeJS.ProcessEnv,
  overrides: RuntimeSettingsOverrides['dailyTechBriefing'] | undefined
) {
  return {
    frontendSecurity: {
      enabled:
        runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_SECURITY_ENABLED != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_SECURITY_ENABLED !== 'false'
          : (overrides?.categories?.frontendSecurity?.enabled ?? true),
      baseIntervalHours: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_SECURITY_INTERVAL_HOURS ??
          overrides?.categories?.frontendSecurity?.baseIntervalHours ??
          4
      ),
      lookbackDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_SECURITY_LOOKBACK_DAYS ??
          overrides?.categories?.frontendSecurity?.lookbackDays ??
          3
      ),
      adaptivePolicy: {
        hotThresholdRuns: 2,
        cooldownEmptyRuns: 6,
        allowedIntervalHours: [2, 4, 8]
      }
    },
    generalSecurity: {
      enabled:
        runtimeEnv.DAILY_TECH_BRIEFING_GENERAL_SECURITY_ENABLED != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_GENERAL_SECURITY_ENABLED !== 'false'
          : (overrides?.categories?.generalSecurity?.enabled ?? true),
      baseIntervalHours: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_GENERAL_SECURITY_INTERVAL_HOURS ??
          overrides?.categories?.generalSecurity?.baseIntervalHours ??
          4
      ),
      lookbackDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_GENERAL_SECURITY_LOOKBACK_DAYS ??
          runtimeEnv.DAILY_TECH_BRIEFING_SECURITY_LOOKBACK_DAYS ??
          overrides?.categories?.generalSecurity?.lookbackDays ??
          overrides?.securityLookbackDays ??
          7
      ),
      adaptivePolicy: {
        hotThresholdRuns: 2,
        cooldownEmptyRuns: 6,
        allowedIntervalHours: [2, 4, 8]
      }
    },
    devtoolSecurity: {
      enabled:
        runtimeEnv.DAILY_TECH_BRIEFING_DEVTOOL_SECURITY_ENABLED != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_DEVTOOL_SECURITY_ENABLED !== 'false'
          : (overrides?.categories?.devtoolSecurity?.enabled ?? true),
      baseIntervalHours: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_DEVTOOL_SECURITY_INTERVAL_HOURS ??
          overrides?.categories?.devtoolSecurity?.baseIntervalHours ??
          4
      ),
      lookbackDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_DEVTOOL_SECURITY_LOOKBACK_DAYS ??
          overrides?.categories?.devtoolSecurity?.lookbackDays ??
          7
      ),
      adaptivePolicy: {
        hotThresholdRuns: 2,
        cooldownEmptyRuns: 6,
        allowedIntervalHours: [2, 4, 8]
      }
    },
    aiTech: {
      enabled:
        runtimeEnv.DAILY_TECH_BRIEFING_AI_TECH_ENABLED != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_AI_TECH_ENABLED !== 'false'
          : (overrides?.categories?.aiTech?.enabled ?? true),
      baseIntervalHours: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_AI_TECH_INTERVAL_HOURS ?? overrides?.categories?.aiTech?.baseIntervalHours ?? 24
      ),
      lookbackDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_AI_LOOKBACK_DAYS ??
          overrides?.categories?.aiTech?.lookbackDays ??
          overrides?.aiLookbackDays ??
          7
      ),
      adaptivePolicy: {
        hotThresholdRuns: 2,
        cooldownEmptyRuns: 6,
        allowedIntervalHours: [12, 24, 48]
      }
    },
    frontendTech: {
      enabled:
        runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_TECH_ENABLED != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_TECH_ENABLED !== 'false'
          : (overrides?.categories?.frontendTech?.enabled ?? true),
      baseIntervalHours: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_TECH_INTERVAL_HOURS ??
          overrides?.categories?.frontendTech?.baseIntervalHours ??
          24
      ),
      lookbackDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_LOOKBACK_DAYS ??
          overrides?.categories?.frontendTech?.lookbackDays ??
          overrides?.frontendLookbackDays ??
          7
      ),
      adaptivePolicy: {
        hotThresholdRuns: 2,
        cooldownEmptyRuns: 6,
        allowedIntervalHours: [12, 24, 48]
      }
    },
    backendTech: {
      enabled:
        runtimeEnv.DAILY_TECH_BRIEFING_BACKEND_TECH_ENABLED != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_BACKEND_TECH_ENABLED !== 'false'
          : (overrides?.categories?.backendTech?.enabled ?? true),
      baseIntervalHours: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_BACKEND_TECH_INTERVAL_HOURS ??
          overrides?.categories?.backendTech?.baseIntervalHours ??
          24
      ),
      lookbackDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_BACKEND_TECH_LOOKBACK_DAYS ??
          overrides?.categories?.backendTech?.lookbackDays ??
          7
      ),
      adaptivePolicy: {
        hotThresholdRuns: 2,
        cooldownEmptyRuns: 6,
        allowedIntervalHours: [12, 24, 48]
      }
    },
    cloudInfraTech: {
      enabled:
        runtimeEnv.DAILY_TECH_BRIEFING_CLOUD_INFRA_TECH_ENABLED != null
          ? runtimeEnv.DAILY_TECH_BRIEFING_CLOUD_INFRA_TECH_ENABLED !== 'false'
          : (overrides?.categories?.cloudInfraTech?.enabled ?? true),
      baseIntervalHours: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_CLOUD_INFRA_TECH_INTERVAL_HOURS ??
          overrides?.categories?.cloudInfraTech?.baseIntervalHours ??
          24
      ),
      lookbackDays: Number(
        runtimeEnv.DAILY_TECH_BRIEFING_CLOUD_INFRA_TECH_LOOKBACK_DAYS ??
          overrides?.categories?.cloudInfraTech?.lookbackDays ??
          7
      ),
      adaptivePolicy: {
        hotThresholdRuns: 2,
        cooldownEmptyRuns: 6,
        allowedIntervalHours: [12, 24, 48]
      }
    }
  };
}

export function buildDailyTechBriefingConfig(
  runtimeEnv: NodeJS.ProcessEnv,
  overrides: RuntimeSettingsOverrides,
  zhipuModels: RuntimeSettings['zhipuModels']
): DailyTechBriefingConfig {
  return {
    enabled:
      runtimeEnv.DAILY_TECH_BRIEFING_ENABLED != null
        ? runtimeEnv.DAILY_TECH_BRIEFING_ENABLED !== 'false'
        : (overrides.dailyTechBriefing?.enabled ?? true),
    schedule: runtimeEnv.DAILY_TECH_BRIEFING_SCHEDULE ?? overrides.dailyTechBriefing?.schedule ?? 'daily 11:00',
    sendEmptyDigest:
      runtimeEnv.DAILY_TECH_BRIEFING_SEND_EMPTY_DIGEST != null
        ? runtimeEnv.DAILY_TECH_BRIEFING_SEND_EMPTY_DIGEST !== 'false'
        : (overrides.dailyTechBriefing?.sendEmptyDigest ?? true),
    maxItemsPerCategory: Number(
      runtimeEnv.DAILY_TECH_BRIEFING_MAX_ITEMS_PER_CATEGORY ?? overrides.dailyTechBriefing?.maxItemsPerCategory ?? 5
    ),
    duplicateWindowDays: Number(
      runtimeEnv.DAILY_TECH_BRIEFING_DUPLICATE_WINDOW_DAYS ?? overrides.dailyTechBriefing?.duplicateWindowDays ?? 7
    ),
    maxNonCriticalItemsPerCategory: Number(
      runtimeEnv.DAILY_TECH_BRIEFING_MAX_NON_CRITICAL_ITEMS_PER_CATEGORY ??
        overrides.dailyTechBriefing?.maxNonCriticalItemsPerCategory ??
        overrides.dailyTechBriefing?.maxItemsPerCategory ??
        runtimeEnv.DAILY_TECH_BRIEFING_MAX_ITEMS_PER_CATEGORY ??
        10
    ),
    maxCriticalItemsPerCategory: Number(
      runtimeEnv.DAILY_TECH_BRIEFING_MAX_CRITICAL_ITEMS_PER_CATEGORY ??
        overrides.dailyTechBriefing?.maxCriticalItemsPerCategory ??
        20
    ),
    maxTotalItemsPerCategory: Number(
      runtimeEnv.DAILY_TECH_BRIEFING_MAX_TOTAL_ITEMS_PER_CATEGORY ??
        overrides.dailyTechBriefing?.maxTotalItemsPerCategory ??
        30
    ),
    sendOnlyDelta:
      runtimeEnv.DAILY_TECH_BRIEFING_SEND_ONLY_DELTA != null
        ? runtimeEnv.DAILY_TECH_BRIEFING_SEND_ONLY_DELTA !== 'false'
        : (overrides.dailyTechBriefing?.sendOnlyDelta ?? true),
    resendOnlyOnMaterialChange:
      runtimeEnv.DAILY_TECH_BRIEFING_RESEND_ONLY_ON_MATERIAL_CHANGE != null
        ? runtimeEnv.DAILY_TECH_BRIEFING_RESEND_ONLY_ON_MATERIAL_CHANGE !== 'false'
        : (overrides.dailyTechBriefing?.resendOnlyOnMaterialChange ?? true),
    larkDigestMode:
      runtimeEnv.DAILY_TECH_BRIEFING_LARK_DIGEST_MODE === 'markdown-summary' ||
      runtimeEnv.DAILY_TECH_BRIEFING_LARK_DIGEST_MODE === 'interactive-card'
        ? runtimeEnv.DAILY_TECH_BRIEFING_LARK_DIGEST_MODE
        : (overrides.dailyTechBriefing?.larkDigestMode ?? 'dual'),
    larkDetailMode:
      runtimeEnv.DAILY_TECH_BRIEFING_LARK_DETAIL_MODE === 'summary' ||
      runtimeEnv.DAILY_TECH_BRIEFING_LARK_DETAIL_MODE === 'detailed'
        ? runtimeEnv.DAILY_TECH_BRIEFING_LARK_DETAIL_MODE
        : (overrides.dailyTechBriefing?.larkDetailMode ?? 'detailed'),
    sourcePolicy:
      runtimeEnv.DAILY_TECH_BRIEFING_SOURCE_POLICY === 'official-only' ||
      overrides.dailyTechBriefing?.sourcePolicy === 'official-only'
        ? 'official-only'
        : 'tiered-authority',
    webhookEnvVar:
      runtimeEnv.DAILY_TECH_BRIEFING_WEBHOOK_ENV_VAR ??
      overrides.dailyTechBriefing?.webhookEnvVar ??
      'LARK_BOT_WEBHOOK_URL',
    webhookUrl:
      runtimeEnv[
        runtimeEnv.DAILY_TECH_BRIEFING_WEBHOOK_ENV_VAR ??
          overrides.dailyTechBriefing?.webhookEnvVar ??
          'LARK_BOT_WEBHOOK_URL'
      ] ?? overrides.dailyTechBriefing?.webhookUrl,
    translationEnabled:
      runtimeEnv.DAILY_TECH_BRIEFING_TRANSLATION_ENABLED != null
        ? runtimeEnv.DAILY_TECH_BRIEFING_TRANSLATION_ENABLED !== 'false'
        : (overrides.dailyTechBriefing?.translationEnabled ?? true),
    translationModel:
      runtimeEnv.DAILY_TECH_BRIEFING_TRANSLATION_MODEL ??
      overrides.dailyTechBriefing?.translationModel ??
      zhipuModels.research,
    aiLookbackDays: Number(
      runtimeEnv.DAILY_TECH_BRIEFING_AI_LOOKBACK_DAYS ?? overrides.dailyTechBriefing?.aiLookbackDays ?? 7
    ),
    frontendLookbackDays: Number(
      runtimeEnv.DAILY_TECH_BRIEFING_FRONTEND_LOOKBACK_DAYS ?? overrides.dailyTechBriefing?.frontendLookbackDays ?? 7
    ),
    securityLookbackDays: Number(
      runtimeEnv.DAILY_TECH_BRIEFING_SECURITY_LOOKBACK_DAYS ?? overrides.dailyTechBriefing?.securityLookbackDays ?? 7
    ),
    categories: buildDailyTechBriefingCategoryConfig(runtimeEnv, overrides.dailyTechBriefing)
  };
}
