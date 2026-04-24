import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as adapters from '@agent/adapters';
import * as core from '@agent/core';
import * as platformRuntime from '@agent/platform-runtime';
import * as reportKit from '@agent/report-kit';
import * as runtime from '@agent/runtime';
import * as tools from '@agent/tools';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('packages public entrypoints smoke', () => {
  it('keeps critical package root exports loadable through @agent/* aliases', () => {
    expect(core.ChatEventRecordSchema).toBeDefined();
    expect(runtime.createAgentGraph).toBeDefined();
    expect(platformRuntime.listWorkflowPresets).toBeDefined();
    expect(tools.createDefaultToolRegistry).toBeDefined();
    expect(adapters.createModelCapabilities).toBeDefined();
    expect(reportKit.renderDataReportJsonBundleFiles).toBeDefined();
  });

  it('keeps package demo smoke coverage discoverable for pnpm test:demo', () => {
    const packageDirs = fs
      .readdirSync(path.join(repoRoot, 'packages'), { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(repoRoot, 'packages', entry.name));

    for (const packageDir of packageDirs) {
      const manifestPath = path.join(packageDir, 'package.json');
      const smokePath = path.join(packageDir, 'demo', 'smoke.ts');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { scripts?: Record<string, string> };

      expect(fs.existsSync(smokePath), `${path.relative(repoRoot, smokePath)} should exist`).toBe(true);
      expect(manifest.scripts?.demo, `${path.relative(repoRoot, manifestPath)} should define demo`).toBeTruthy();
    }
  });
});
