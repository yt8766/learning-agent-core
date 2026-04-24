import path from 'node:path';

import fs from 'fs-extra';
import YAML from 'yaml';

import {
  IntelChannelsConfigSchema,
  IntelRoutesConfigSchema,
  IntelSourcesConfigSchema,
  type IntelChannelsConfig,
  type IntelRoutesConfig,
  type IntelSourcesConfig
} from '../../flows/intel/schemas/intel-config.schema';

export interface IntelConfigSet {
  sources: IntelSourcesConfig;
  channels: IntelChannelsConfig;
  routes: IntelRoutesConfig;
}

async function readYamlFile<T>(filePath: string, schema: { parse: (value: unknown) => T }): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return schema.parse(YAML.parse(raw));
}

export async function loadIntelConfigSet(configDir: string): Promise<IntelConfigSet> {
  const [sources, channels, routes] = await Promise.all([
    readYamlFile(path.join(configDir, 'sources.yaml'), IntelSourcesConfigSchema),
    readYamlFile(path.join(configDir, 'channels.yaml'), IntelChannelsConfigSchema),
    readYamlFile(path.join(configDir, 'routes.yaml'), IntelRoutesConfigSchema)
  ]);

  return {
    sources,
    channels,
    routes
  };
}
