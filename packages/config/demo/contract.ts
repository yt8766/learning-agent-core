import {
  DEFAULT_DATA_PATHS,
  buildProfileOverrides,
  loadSettings,
  mergeNormalizedPolicy,
  parseDotEnvFile
} from '../src/index.js';
import * as contractSettingsFacade from '../src/contracts/settings-facade.js';
import * as compatSettingsRoot from '../src/settings.js';
import { loadSettings as canonicalLoadSettings } from '../src/loaders/settings-loader.js';
import { DEFAULT_DATA_PATHS as canonicalDefaultDataPaths } from '../src/shared/settings-defaults.js';
import { buildProfileOverrides as canonicalBuildProfileOverrides } from '../src/profiles/runtime-profile-overrides.js';
import { mergeNormalizedPolicy as canonicalMergeNormalizedPolicy } from '../src/policies/runtime-policy-defaults.js';
import { parseDotEnvFile as canonicalParseDotEnvFile } from '../src/utils/settings-helpers.js';

const contractAligned =
  loadSettings === contractSettingsFacade.loadSettings &&
  DEFAULT_DATA_PATHS === contractSettingsFacade.DEFAULT_DATA_PATHS &&
  buildProfileOverrides === contractSettingsFacade.buildProfileOverrides &&
  mergeNormalizedPolicy === contractSettingsFacade.mergeNormalizedPolicy &&
  parseDotEnvFile === contractSettingsFacade.parseDotEnvFile;

const canonicalAligned =
  loadSettings === canonicalLoadSettings &&
  DEFAULT_DATA_PATHS === canonicalDefaultDataPaths &&
  buildProfileOverrides === canonicalBuildProfileOverrides &&
  mergeNormalizedPolicy === canonicalMergeNormalizedPolicy &&
  parseDotEnvFile === canonicalParseDotEnvFile;

const compatAligned =
  compatSettingsRoot.loadSettings === canonicalLoadSettings &&
  compatSettingsRoot.DEFAULT_DATA_PATHS === canonicalDefaultDataPaths &&
  compatSettingsRoot.buildProfileOverrides === canonicalBuildProfileOverrides &&
  compatSettingsRoot.mergeNormalizedPolicy === canonicalMergeNormalizedPolicy &&
  compatSettingsRoot.parseDotEnvFile === canonicalParseDotEnvFile;

console.log(
  JSON.stringify(
    {
      contractAligned,
      canonicalAligned,
      compatAligned
    },
    null,
    2
  )
);
