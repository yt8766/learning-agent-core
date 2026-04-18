import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolvePromptRegressionRun } from '../../../scripts/check-staged.js';

const ROOT = path.resolve(import.meta.dirname, '../../..');

describe('check-staged prompt regression gating', () => {
  it('requires prompt regression for staged prompt-related files', () => {
    expect(
      resolvePromptRegressionRun(['agents/supervisor/src/flows/supervisor/prompts/supervisor-plan-prompts.ts'])
    ).toEqual({
      required: true,
      files: ['agents/supervisor/src/flows/supervisor/prompts/supervisor-plan-prompts.ts']
    });

    expect(resolvePromptRegressionRun(['packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml'])).toEqual({
      required: true,
      files: ['packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml']
    });
  });

  it('skips prompt regression for non-prompt-only staged files', () => {
    expect(resolvePromptRegressionRun(['docs/evals/promptfoo-regression.md'])).toEqual({
      required: false,
      files: []
    });
  });

  it('tracks prompt regression tooling changes as blocking inputs', () => {
    expect(resolvePromptRegressionRun(['scripts/run-prompt-regression.js'])).toEqual({
      required: true,
      files: ['scripts/run-prompt-regression.js']
    });
  });
});

describe('pr workflow prompt regression trigger', () => {
  it('watches prompt paths explicitly in the PR workflow', async () => {
    const workflow = await readFile(path.join(ROOT, '.github/workflows/pr-check.yml'), 'utf8');

    expect(workflow).toContain('agents:');
    expect(workflow).toContain("- 'agents/**'");
    expect(workflow).toContain('prompts:');
    expect(workflow).toContain("- 'agents/**/prompts/**'");
    expect(workflow).toContain("- 'packages/**/prompts/**'");
    expect(workflow).toContain("- 'apps/**/prompts/**'");
    expect(workflow).toContain("needs.detect-changes.outputs.prompts == 'true'");
  });

  it('keeps the PR verify pipeline parallelized behind an aggregate status check', async () => {
    const workflow = await readFile(path.join(ROOT, '.github/workflows/pr-check.yml'), 'utf8');

    expect(workflow).toContain('verify-foundation:');
    expect(workflow).toContain('verify-parallel:');
    expect(workflow).toContain('terminology:');
    expect(workflow).toContain('strategy:');
    expect(workflow).toContain('matrix:');
    expect(workflow).toContain('name: Affected Verify');
    expect(workflow).toContain('needs.verify-foundation.result');
    expect(workflow).toContain('needs.verify-parallel.result');
    expect(workflow).toContain('name: Terminology Check');
  });
});

describe('workflow email actions', () => {
  it('pins email notifications to the Node 24-ready send-mail action', async () => {
    const prWorkflow = await readFile(path.join(ROOT, '.github/workflows/pr-check.yml'), 'utf8');
    const mainWorkflow = await readFile(path.join(ROOT, '.github/workflows/main-check.yml'), 'utf8');

    expect(prWorkflow).toContain('uses: dawidd6/action-send-mail@v6');
    expect(mainWorkflow).toContain('uses: dawidd6/action-send-mail@v6');
    expect(prWorkflow).toContain("subject: '✅ [PR Success]");
    expect(prWorkflow).toContain("subject: '❌ [PR Failure]");
    expect(mainWorkflow).toContain("subject: '✅ [Main Success]");
    expect(mainWorkflow).toContain("subject: '❌ [Main Failure]");
  });

  it('keeps the main workflow parallelized behind aggregate verify and build jobs', async () => {
    const workflow = await readFile(path.join(ROOT, '.github/workflows/main-check.yml'), 'utf8');

    expect(workflow).toContain('detect-changes:');
    expect(workflow).toContain('verify-foundation:');
    expect(workflow).toContain('verify-parallel:');
    expect(workflow).toContain('verify-main:');
    expect(workflow).toContain('build-main:');
    expect(workflow).toContain('coverage-main:');
    expect(workflow).toContain('strategy:');
    expect(workflow).toContain('matrix:');
    expect(workflow).toContain('needs.verify-main.result');
    expect(workflow).toContain('needs.build-main.result');
    expect(workflow).toContain('name: Verify Main Gate Summary');
    expect(workflow).toContain('name: Run Full Build');
    expect(workflow).toContain('name: Run Coverage (Non-blocking Baseline Check)');
    expect(workflow).toContain("if: needs.detect-changes.outputs.any_code == 'true'");
  });
});

describe('workflow setup reuse', () => {
  it('reuses the shared workspace setup action across PR and main workflows', async () => {
    const prWorkflow = await readFile(path.join(ROOT, '.github/workflows/pr-check.yml'), 'utf8');
    const mainWorkflow = await readFile(path.join(ROOT, '.github/workflows/main-check.yml'), 'utf8');
    const setupAction = await readFile(path.join(ROOT, '.github/actions/setup-pnpm-workspace/action.yml'), 'utf8');
    const nodeSetupAction = await readFile(path.join(ROOT, '.github/actions/setup-node-runtime/action.yml'), 'utf8');
    const fetchBaseAction = await readFile(path.join(ROOT, '.github/actions/fetch-pr-base-ref/action.yml'), 'utf8');

    expect(prWorkflow).toContain('uses: ./.github/actions/setup-pnpm-workspace');
    expect(mainWorkflow).toContain('uses: ./.github/actions/setup-pnpm-workspace');
    expect(prWorkflow).toContain('uses: ./.github/actions/setup-node-runtime');
    expect(mainWorkflow).toContain('uses: ./.github/actions/setup-node-runtime');
    expect(prWorkflow).toContain('uses: ./.github/actions/fetch-pr-base-ref');
    expect(setupAction).toContain('pnpm install --frozen-lockfile --prefer-offline');
    expect(nodeSetupAction).toContain('actions/setup-node@v5');
    expect(nodeSetupAction).toContain('package-manager-cache: false');
    expect(fetchBaseAction).toContain('git fetch --no-tags --prune --depth=');
    expect(mainWorkflow).toContain('coverage-main:');
    expect(mainWorkflow).toContain('- name: Setup Workspace');
  });
});
