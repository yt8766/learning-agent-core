import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DATA_PATHS,
  buildProfileOverrides,
  loadSettings,
  mergeNormalizedPolicy,
  parseDotEnvFile
} from '@agent/config';
import * as contractSettingsFacade from '../src/contracts/settings-facade';
import * as compatSettingsRoot from '../src/settings';
import { loadSettings as directLoadSettings } from '../src/loaders/settings-loader';
import {
  buildDailyTechBriefingCategoryConfig as hostBuildDailyTechBriefingCategoryConfig,
  buildDailyTechBriefingConfig as hostBuildDailyTechBriefingConfig
} from '../src/briefings/daily-tech-briefing';
import { DEFAULT_DATA_PATHS as hostDefaultDataPaths } from '../src/shared/settings-defaults';
import { buildProfileOverrides as hostBuildProfileOverrides } from '../src/profiles/runtime-profile-overrides';
import { mergeNormalizedPolicy as hostMergeNormalizedPolicy } from '../src/policies/runtime-policy-defaults';
import {
  buildMergedOverrides as hostBuildMergedOverrides,
  resolveSettingsPaths as hostResolveSettingsPaths
} from '../src/loaders/settings-paths';
import { parseDotEnvFile as hostParseDotEnvFile } from '../src/utils/settings-helpers';

describe('config root exports', () => {
  it('points root exports to canonical hosts', () => {
    expect(loadSettings).toBe(directLoadSettings);
    expect(DEFAULT_DATA_PATHS).toBe(hostDefaultDataPaths);
    expect(buildProfileOverrides).toBe(hostBuildProfileOverrides);
    expect(mergeNormalizedPolicy).toBe(hostMergeNormalizedPolicy);
    expect(parseDotEnvFile).toBe(hostParseDotEnvFile);
  });

  it('keeps the package root aligned with the stable settings facade contract', () => {
    expect(loadSettings).toBe(contractSettingsFacade.loadSettings);
    expect(DEFAULT_DATA_PATHS).toBe(contractSettingsFacade.DEFAULT_DATA_PATHS);
    expect(buildProfileOverrides).toBe(contractSettingsFacade.buildProfileOverrides);
    expect(mergeNormalizedPolicy).toBe(contractSettingsFacade.mergeNormalizedPolicy);
    expect(parseDotEnvFile).toBe(contractSettingsFacade.parseDotEnvFile);
  });

  it('keeps settings compat entrypoints forwarding to canonical hosts', () => {
    expect(compatSettingsRoot.loadSettings).toBe(directLoadSettings);
    expect(compatSettingsRoot.DEFAULT_DATA_PATHS).toBe(hostDefaultDataPaths);
    expect(compatSettingsRoot.buildProfileOverrides).toBe(hostBuildProfileOverrides);
    expect(compatSettingsRoot.mergeNormalizedPolicy).toBe(hostMergeNormalizedPolicy);
    expect(compatSettingsRoot.parseDotEnvFile).toBe(hostParseDotEnvFile);
    expect(compatSettingsRoot.buildMergedOverrides).toBe(hostBuildMergedOverrides);
    expect(compatSettingsRoot.resolveSettingsPaths).toBe(hostResolveSettingsPaths);
    expect(compatSettingsRoot.buildDailyTechBriefingConfig).toBe(hostBuildDailyTechBriefingConfig);
    expect(compatSettingsRoot.buildDailyTechBriefingCategoryConfig).toBe(hostBuildDailyTechBriefingCategoryConfig);
  });

  it('retains settings aggregate entrypoints as human-readable long-term facades', () => {
    expect(existsSync(new URL('../src/settings.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../src/settings/index.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../src/contracts/settings-facade.ts', import.meta.url))).toBe(true);
  });

  it('removes runtime compat wrapper files once loaders and briefings become canonical hosts', () => {
    expect(existsSync(new URL('../src/runtime/daily-tech-briefing.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/runtime/settings-loader.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/runtime/settings-paths.ts', import.meta.url))).toBe(false);
  });
});
